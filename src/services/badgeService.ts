import { config } from '../config';
import { db } from '../db';
import { adjustLiquid, getAccount, recordTransaction } from './accountService';
import { getIncomeMultiplier } from './assetService';
import { getTenant } from './authService';
import { round2 } from '../utils/http';
import type { Badge, TenantBadge } from '../models/types';

export function listBadges(): Badge[] {
  return db.prepare('SELECT * FROM badges ORDER BY id ASC').all() as Badge[];
}

export function listTenantBadges(tenantId: number): TenantBadge[] {
  return db
    .prepare(
      `SELECT tb.id, tb.tenant_id, tb.badge_id, tb.awarded_at,
              b.code, b.name, b.emoji
         FROM tenant_badges tb
         JOIN badges b ON b.id = tb.badge_id
        WHERE tb.tenant_id = ?
        ORDER BY tb.awarded_at DESC`,
    )
    .all(tenantId) as TenantBadge[];
}

function hasBadge(tenantId: number, code: string): boolean {
  const row = db
    .prepare(
      `SELECT 1 FROM tenant_badges tb
         JOIN badges b ON b.id = tb.badge_id
        WHERE tb.tenant_id = ? AND b.code = ?`,
    )
    .get(tenantId, code);
  return Boolean(row);
}

export function awardBadge(tenantId: number, code: string): TenantBadge | null {
  const badge = db
    .prepare('SELECT * FROM badges WHERE code = ?')
    .get(code) as Badge | undefined;
  if (!badge) return null;
  if (hasBadge(tenantId, code)) return null;

  const info = db
    .prepare('INSERT OR IGNORE INTO tenant_badges (tenant_id, badge_id) VALUES (?, ?)')
    .run(tenantId, badge.id);
  if (info.changes === 0) return null;

  if (config.badge.reward > 0) {
    adjustLiquid(tenantId, config.badge.reward);
    recordTransaction(tenantId, 'badge_reward', config.badge.reward, {
      refTable: 'badges',
      refId: badge.id,
      note: `${badge.emoji} ${badge.name}`,
    });
  }

  return {
    id: Number(info.lastInsertRowid),
    tenant_id: tenantId,
    badge_id: badge.id,
    awarded_at: new Date().toISOString(),
    code: badge.code,
    name: badge.name,
    emoji: badge.emoji,
  };
}

function satisfies(tenantId: number, code: string): boolean {
  const tenant = getTenant(tenantId);

  switch (code) {
    case 'first_checkin':
      return (
        (db.prepare('SELECT COUNT(*) AS n FROM checkins WHERE tenant_id = ?').get(tenantId) as {
          n: number;
        }).n > 0
      );
    case 'streak_3':
    case 'streak_7':
    case 'streak_30': {
      const need = Number(code.split('_')[1]);
      const row = db
        .prepare('SELECT COALESCE(MAX(streak), 0) AS s FROM checkins WHERE tenant_id = ?')
        .get(tenantId) as { s: number };
      return row.s >= need;
    }
    case 'first_asset':
      return (
        (db
          .prepare('SELECT COUNT(*) AS n FROM assets WHERE owner_tenant_id = ?')
          .get(tenantId) as { n: number }).n > 0
      );
    case 'multiplier_2':
      return getIncomeMultiplier(tenantId) >= 2;
    case 'saver_100':
      return getAccount(tenantId).savings_balance >= 100;
    case 'first_loan':
      return (
        (db.prepare('SELECT COUNT(*) AS n FROM loans WHERE tenant_id = ?').get(tenantId) as {
          n: number;
        }).n > 0
      );
    case 'debt_free':
      return (
        (db
          .prepare("SELECT COUNT(*) AS n FROM loans WHERE tenant_id = ? AND status = 'repaid'")
          .get(tenantId) as { n: number }).n > 0
      );
    case 'proposal_approved':
      return (
        (db
          .prepare("SELECT COUNT(*) AS n FROM proposals WHERE tenant_id = ? AND status = 'approved'")
          .get(tenantId) as { n: number }).n > 0
      );
    case 'boss':
      return tenant.game_role === 'ceo';
    default:
      return false;
  }
}

export function evaluateBadges(tenantId: number): TenantBadge[] {
  const codes = (db.prepare('SELECT code FROM badges').all() as { code: string }[]).map(
    (r) => r.code,
  );
  const unlocked: TenantBadge[] = [];
  for (const code of codes) {
    if (hasBadge(tenantId, code)) continue;
    if (satisfies(tenantId, code)) {
      const awarded = awardBadge(tenantId, code);
      if (awarded) unlocked.push(awarded);
    }
  }
  return unlocked;
}

export function badgeRewardTotal(tenantId: number): number {
  const row = db
    .prepare('SELECT COUNT(*) AS n FROM tenant_badges WHERE tenant_id = ?')
    .get(tenantId) as { n: number };
  return round2(row.n * config.badge.reward);
}
