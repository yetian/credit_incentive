import type { Request, Response } from 'express';
import { getTenant } from '../services/authService';
import { getAccount, listTransactions } from '../services/accountService';
import { getIncomeMultiplier } from '../services/assetService';
import { listBadges, listTenantBadges } from '../services/badgeService';
import { roleProgress } from '../services/roleService';
import { listStreaks } from '../services/checkinService';
import { listLoans, maxLoanAmount } from '../services/loanService';
import { db } from '../db';

export function getProfile(req: Request, res: Response): void {
  const tenantId = req.tenantId!;
  const tenant = getTenant(tenantId);

  const checkinStats = db
    .prepare(
      `SELECT COUNT(*) AS total_checkins,
              COALESCE(SUM(credit_awarded), 0) AS total_earned
         FROM checkins WHERE tenant_id = ? AND is_revoked = 0`,
    )
    .get(tenantId) as { total_checkins: number; total_earned: number };

  res.json({
    tenant,
    account: getAccount(tenantId),
    credit_score: tenant.credit_score,
    loan_limit: maxLoanAmount(tenant.credit_score),
    income_multiplier: getIncomeMultiplier(tenantId),
    role_progress: roleProgress(tenantId),
    badges: listTenantBadges(tenantId),
    streaks: listStreaks(tenantId).filter((s) => s.current_streak > 0),
    stats: checkinStats,
    active_loans: listLoans(tenantId).filter((l) => l.status === 'active'),
    recent_transactions: listTransactions(tenantId, 10),
  });
}

export function listAllBadges(_req: Request, res: Response): void {
  res.json({ badges: listBadges() });
}

export function listMyBadges(req: Request, res: Response): void {
  res.json({ badges: listTenantBadges(req.tenantId!) });
}

export function getProgress(req: Request, res: Response): void {
  res.json({ progress: roleProgress(req.tenantId!) });
}
