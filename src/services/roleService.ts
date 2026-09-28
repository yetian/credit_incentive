import { config } from '../config';
import { db } from '../db';
import { adjustLiquid, getAccount, recordTransaction } from './accountService';
import { getTenant } from './authService';
import type { GameRole, Tenant } from '../models/types';

const PROMOTION_BONUS = 50;

export interface RoleProgress {
  role: GameRole;
  next: GameRole | null;
  requirements: { label: string; met: boolean; current: number; need: number }[];
}

function count(sql: string, tenantId: number): number {
  return (db.prepare(sql).get(tenantId) as { n: number }).n;
}

export function roleProgress(tenantId: number): RoleProgress {
  const tenant = getTenant(tenantId);
  const account = getAccount(tenantId);

  // The global admin does not participate in in-game progression.
  if (tenant.role === 'PARENT') {
    return { role: 'ceo', next: null, requirements: [] };
  }

  if (tenant.game_role === 'employee') {
    const approved = count(
      "SELECT COUNT(*) AS n FROM proposals WHERE tenant_id = ? AND status = 'approved'",
      tenantId,
    );
    const assets = count('SELECT COUNT(*) AS n FROM assets WHERE owner_tenant_id = ?', tenantId);
    return {
      role: tenant.game_role,
      next: 'contractor',
      requirements: [
        {
          label: '提案通过',
          met: approved >= config.role.contractor.minApprovedProposals,
          current: approved,
          need: config.role.contractor.minApprovedProposals,
        },
        {
          label: '拥有工具',
          met: assets >= config.role.contractor.minOwnedAssets,
          current: assets,
          need: config.role.contractor.minOwnedAssets,
        },
      ],
    };
  }

  if (tenant.game_role === 'contractor') {
    const repaid = count(
      "SELECT COUNT(*) AS n FROM loans WHERE tenant_id = ? AND status = 'repaid'",
      tenantId,
    );
    return {
      role: tenant.game_role,
      next: 'ceo',
      requirements: [
        {
          label: '还清贷款',
          met: repaid >= config.role.ceo.minRepaidLoans,
          current: repaid,
          need: config.role.ceo.minRepaidLoans,
        },
        {
          label: '储蓄余额',
          met: account.savings_balance >= config.role.ceo.minSavings,
          current: account.savings_balance,
          need: config.role.ceo.minSavings,
        },
        {
          label: '信用分',
          met: tenant.credit_score >= config.role.ceo.minCreditScore,
          current: tenant.credit_score,
          need: config.role.ceo.minCreditScore,
        },
      ],
    };
  }

  return { role: 'ceo', next: null, requirements: [] };
}

export interface PromotionResult {
  promoted: boolean;
  from: GameRole;
  to: GameRole;
  bonus: number;
}

export function evaluateRole(tenantId: number): PromotionResult {
  const progress = roleProgress(tenantId);
  const from = progress.role;

  // Admins and maxed-out children are not promoted.
  if (getTenant(tenantId).role === 'PARENT' || !progress.next) {
    return { promoted: false, from, to: from, bonus: 0 };
  }
  if (!progress.requirements.every((r) => r.met)) {
    return { promoted: false, from, to: from, bonus: 0 };
  }

  const to = progress.next;
  db.prepare('UPDATE tenants SET game_role = ? WHERE id = ?').run(to, tenantId);
  adjustLiquid(tenantId, PROMOTION_BONUS);
  recordTransaction(tenantId, 'promotion_bonus', PROMOTION_BONUS, {
    refTable: 'tenants',
    refId: tenantId,
    note: `promoted ${from} -> ${to}`,
  });

  return { promoted: true, from, to, bonus: PROMOTION_BONUS };
}

export function getTenantWithProgress(tenantId: number): Tenant & { progress: RoleProgress } {
  const tenant = getTenant(tenantId);
  return { ...tenant, progress: roleProgress(tenantId) };
}
