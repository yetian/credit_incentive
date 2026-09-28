import type { Request, Response } from 'express';
import { db } from '../db';
import * as taskService from '../services/taskService';
import * as checkinService from '../services/checkinService';
import { getTenant, listTenants } from '../services/authService';
import {
  adjustLiquid,
  adjustSavings,
  getAccount,
  listTransactions,
  recordTransaction,
} from '../services/accountService';
import { getIncomeMultiplier } from '../services/assetService';
import { listLoans, maxLoanAmount, setCreditScore } from '../services/loanService';
import { listProposals } from '../services/proposalService';
import { roleProgress } from '../services/roleService';
import { HttpError, round2 } from '../utils/http';
import type { Checkin, Transaction } from '../models/types';

function childrenDashboard() {
  const children = listTenants().filter((t) => t.role === 'CHILD');
  return children.map((child) => {
    const checkins = db
      .prepare('SELECT * FROM checkins WHERE tenant_id = ? ORDER BY id DESC LIMIT 20')
      .all(child.id) as Checkin[];
    const stats = db
      .prepare(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(credit_awarded), 0) AS earned,
                COALESCE(SUM(is_revoked), 0) AS revoked
           FROM checkins WHERE tenant_id = ?`,
      )
      .get(child.id) as { total: number; earned: number; revoked: number };

    return {
      tenant: child,
      account: getAccount(child.id),
      credit_score: child.credit_score,
      loan_limit: maxLoanAmount(child.credit_score),
      income_multiplier: getIncomeMultiplier(child.id),
      role_progress: roleProgress(child.id),
      stats,
      recent_checkins: checkins,
      pending_proposals: listProposals({ tenantId: child.id, status: 'pending' }),
      active_loans: listLoans(child.id).filter((l) => l.status === 'active'),
      recent_transactions: listTransactions(child.id, 10),
    };
  });
}

export function listChildren(_req: Request, res: Response): void {
  res.json({ children: childrenDashboard() });
}

export function childDetail(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new HttpError(400, 'invalid child id');
  const child = getTenant(id);
  res.json({
    child,
    account: getAccount(id),
    checkins: checkinService.listCheckins(id, 100),
    transactions: listTransactions(id, 100),
    proposals: listProposals({ tenantId: id }),
    loans: listLoans(id),
  });
}

export function createTask(req: Request, res: Response): void {
  const task = taskService.createTask(req.tenantId!, {
    title: req.body?.title,
    description: req.body?.description ?? null,
    kind: req.body?.kind,
    base_credit: req.body?.base_credit,
    tenant_id: req.body?.child_id ?? null, // null => global task
  });
  res.status(201).json({ task });
}

export function listTasks(_req: Request, res: Response): void {
  res.json({ tasks: taskService.listAllTasks() });
}

export function setTaskActive(req: Request, res: Response): void {
  const taskId = Number(req.params.id);
  if (!Number.isInteger(taskId)) throw new HttpError(400, 'invalid task id');
  const active = req.body?.active !== false;
  res.json({ task: taskService.adminSetTaskActive(taskId, active) });
}

export function revokeCheckin(req: Request, res: Response): void {
  const checkinId = Number(req.params.id);
  if (!Number.isInteger(checkinId)) throw new HttpError(400, 'invalid check-in id');
  const result = checkinService.revokeCheckin(req.tenantId!, checkinId);
  res.json(result);
}

export interface AdjustBody {
  liquid_delta?: number;
  savings_delta?: number;
  credit_score?: number;
  note?: string;
}

export function adjustChild(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new HttpError(400, 'invalid child id');
  const child = getTenant(id);
  if (child.role !== 'CHILD') throw new HttpError(400, 'Target is not a child account');

  const body = req.body as AdjustBody;

  return void db.transaction(() => {
    const applied: string[] = [];

    if (body.liquid_delta !== undefined) {
      const delta = round2(Number(body.liquid_delta));
      if (!Number.isFinite(delta) || delta === 0) {
        throw new HttpError(400, 'liquid_delta must be a non-zero number');
      }
      adjustLiquid(id, delta);
      recordTransaction(id, 'admin_adjustment', delta, {
        refTable: 'tenants',
        refId: id,
        note: body.note ?? '家长调整流动余额',
      });
      applied.push(`liquid ${delta >= 0 ? '+' : ''}${delta}`);
    }

    if (body.savings_delta !== undefined) {
      const delta = round2(Number(body.savings_delta));
      if (!Number.isFinite(delta) || delta === 0) {
        throw new HttpError(400, 'savings_delta must be a non-zero number');
      }
      adjustSavings(id, delta);
      applied.push(`savings ${delta >= 0 ? '+' : ''}${delta}`);
    }

    if (body.credit_score !== undefined) {
      const score = Number(body.credit_score);
      if (!Number.isFinite(score)) throw new HttpError(400, 'credit_score must be a number');
      setCreditScore(id, score);
      applied.push(`credit_score -> ${score}`);
    }

    if (!applied.length) {
      throw new HttpError(400, 'Nothing to adjust');
    }

    res.json({
      tenant: getTenant(id),
      account: getAccount(id),
      applied,
    });
  })();
}

export function childTransactions(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new HttpError(400, 'invalid child id');
  const limit = Number(req.query.limit) || 100;
  res.json({ transactions: listTransactions(id, limit) as Transaction[] });
}
