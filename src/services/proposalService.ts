import { db } from '../db';
import { adjustLiquid, getAccount, recordTransaction } from './accountService';
import { HttpError, round2 } from '../utils/http';
import type { GameRole, Proposal, ProposalStatus, TenantRole } from '../models/types';

export interface Reviewer {
  id: number;
  role: TenantRole;
  gameRole: GameRole;
}

function assertReviewer(reviewer: Reviewer): void {
  const allowed = reviewer.role === 'PARENT' || ['contractor', 'ceo'].includes(reviewer.gameRole);
  if (!allowed) {
    throw new HttpError(403, 'Only PARENT or contractor/ceo can review proposals');
  }
}

export interface ProposalInput {
  title: string;
  description?: string | null;
  budget_requested: number;
  expected_return?: number;
}

export function createProposal(tenantId: number, input: ProposalInput): Proposal {
  const title = (input.title ?? '').trim();
  if (!title) throw new HttpError(400, 'title is required');

  const budget = Number(input.budget_requested);
  if (!Number.isFinite(budget) || budget < 0) {
    throw new HttpError(400, 'budget_requested must be a non-negative number');
  }
  const expected = Number(input.expected_return ?? 0);
  if (!Number.isFinite(expected) || expected < 0) {
    throw new HttpError(400, 'expected_return must be a non-negative number');
  }

  const info = db
    .prepare(
      `INSERT INTO proposals
         (tenant_id, title, description, budget_requested, expected_return, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
    )
    .run(tenantId, title, input.description ?? null, round2(budget), round2(expected));

  return getProposal(Number(info.lastInsertRowid));
}

export function getProposal(proposalId: number): Proposal {
  const proposal = db
    .prepare('SELECT * FROM proposals WHERE id = ?')
    .get(proposalId) as Proposal | undefined;
  if (!proposal) throw new HttpError(404, 'Proposal not found');
  return proposal;
}

export function listProposals(
  filter: { tenantId?: number; status?: ProposalStatus } = {},
): Proposal[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId !== undefined) {
    clauses.push('tenant_id = ?');
    params.push(filter.tenantId);
  }
  if (filter.status) {
    clauses.push('status = ?');
    params.push(filter.status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db
    .prepare(`SELECT * FROM proposals ${where} ORDER BY id DESC`)
    .all(...params) as Proposal[];
}

export function reviewProposal(
  reviewer: Reviewer,
  proposalId: number,
  decision: 'approved' | 'rejected',
  note?: string,
): { proposal: Proposal; budget_released: number; liquid_balance: number } {
  assertReviewer(reviewer);

  return db.transaction(() => {
    const proposal = getProposal(proposalId);
    if (proposal.status !== 'pending') {
      throw new HttpError(409, `Proposal already ${proposal.status}`);
    }

    let budgetReleased = 0;
    if (decision === 'approved' && proposal.budget_requested > 0) {
      budgetReleased = proposal.budget_requested;
      adjustLiquid(proposal.tenant_id, budgetReleased);
      recordTransaction(proposal.tenant_id, 'proposal_budget', budgetReleased, {
        refTable: 'proposals',
        refId: proposal.id,
        note: `approved: ${proposal.title}`,
      });
    }

    db.prepare(
      `UPDATE proposals
         SET status = ?, reviewed_by = ?, review_note = ?, reviewed_at = datetime('now')
       WHERE id = ?`,
    ).run(decision, reviewer.id, note ?? null, proposalId);

    return {
      proposal: getProposal(proposalId),
      budget_released: budgetReleased,
      liquid_balance: getAccount(proposal.tenant_id).liquid_balance,
    };
  })();
}

export interface SettleResult {
  proposal: Proposal;
  actual_return: number;
  liquid_balance: number;
}

export function settleProposal(
  reviewer: Reviewer,
  proposalId: number,
  actualReturn: number,
  note?: string,
): SettleResult {
  assertReviewer(reviewer);

  const value = Number(actualReturn);
  if (!Number.isFinite(value)) {
    throw new HttpError(400, 'actual_return must be a number');
  }

  return db.transaction(() => {
    const proposal = getProposal(proposalId);
    if (proposal.status !== 'approved') {
      throw new HttpError(409, 'Only approved proposals can be settled');
    }
    if (proposal.settled_at) {
      throw new HttpError(409, 'Proposal already settled');
    }

    const amount = round2(value);
    if (amount !== 0) {
      adjustLiquid(proposal.tenant_id, amount);
      recordTransaction(proposal.tenant_id, 'proposal_return', amount, {
        refTable: 'proposals',
        refId: proposal.id,
        note: note ?? `结算: ${proposal.title}`,
      });
    }

    db.prepare(
      `UPDATE proposals
          SET actual_return = ?, settled_at = datetime('now')
        WHERE id = ?`,
    ).run(amount, proposalId);

    return {
      proposal: getProposal(proposalId),
      actual_return: amount,
      liquid_balance: getAccount(proposal.tenant_id).liquid_balance,
    };
  })();
}
