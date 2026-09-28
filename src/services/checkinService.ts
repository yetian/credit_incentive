import { db } from '../db';
import { adjustLiquid, getAccount, recordTransaction } from './accountService';
import { getIncomeMultiplier } from './assetService';
import { getTask } from './taskService';
import { evaluateBadges } from './badgeService';
import { evaluateRole } from './roleService';
import { HttpError, round2 } from '../utils/http';
import type { Checkin, TenantBadge, TransactionType } from '../models/types';
import type { PromotionResult } from './roleService';

export interface CheckinInput {
  taskId: number;
  proof?: string | null;
  note?: string | null;
}

export interface CheckinResult {
  checkin: Checkin;
  credit_awarded: number;
  streak_bonus: number;
  multiplier_applied: number;
  streak: number;
  liquid_balance: number;
  unlocked_badges: TenantBadge[];
  promotion: PromotionResult;
}

function utcDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function previousUtcDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return utcDate(d);
}

export function completeCheckin(tenantId: number, input: CheckinInput): CheckinResult {
  return db.transaction(() => {
    const task = getTask(input.taskId);
    if (!task.active) throw new HttpError(400, 'Task is archived');
    if (task.tenant_id !== null && task.tenant_id !== tenantId) {
      throw new HttpError(403, 'Task does not belong to this tenant');
    }

    const today = utcDate();
    const alreadyToday = db
      .prepare(
        'SELECT id FROM checkins WHERE tenant_id = ? AND task_id = ? AND checked_on = ? AND is_revoked = 0',
      )
      .get(tenantId, task.id, today);
    if (alreadyToday) {
      throw new HttpError(409, '今天已完成该任务');
    }

    const prev = db
      .prepare(
        `SELECT checked_on, streak FROM checkins
          WHERE tenant_id = ? AND task_id = ? AND checked_on IS NOT NULL AND is_revoked = 0
          ORDER BY checked_on DESC LIMIT 1`,
      )
      .get(tenantId, task.id) as { checked_on: string; streak: number } | undefined;

    const streak = prev && prev.checked_on === previousUtcDate() ? prev.streak + 1 : 1;

    const multiplier = getIncomeMultiplier(tenantId);
    const credit = round2(task.base_credit * multiplier);
    const streakBonus = streak > 0 && streak % 7 === 0 ? round2(task.base_credit * 0.5) : 0;
    const type: TransactionType =
      task.kind === 'bounty' ? 'bounty_reward' : 'checkin_reward';

    const info = db
      .prepare(
        `INSERT INTO checkins
           (tenant_id, task_id, proof, credit_awarded, multiplier_applied, status, note, checked_on, streak)
         VALUES (?, ?, ?, ?, ?, 'approved', ?, ?, ?)`,
      )
      .run(
        tenantId,
        task.id,
        input.proof ?? null,
        credit,
        multiplier,
        input.note ?? null,
        today,
        streak,
      );

    const checkinId = Number(info.lastInsertRowid);
    adjustLiquid(tenantId, credit);
    recordTransaction(tenantId, type, credit, {
      refTable: 'checkins',
      refId: checkinId,
      note: task.title,
    });

    if (streakBonus > 0) {
      adjustLiquid(tenantId, streakBonus);
      recordTransaction(tenantId, 'streak_bonus', streakBonus, {
        refTable: 'checkins',
        refId: checkinId,
        note: `${streak} 天连击`,
      });
    }

    const checkin = db
      .prepare('SELECT * FROM checkins WHERE id = ?')
      .get(checkinId) as Checkin;

    const unlockedBadges = evaluateBadges(tenantId);
    const promotion = evaluateRole(tenantId);

    return {
      checkin,
      credit_awarded: credit,
      streak_bonus: streakBonus,
      multiplier_applied: multiplier,
      streak,
      liquid_balance: getAccount(tenantId).liquid_balance,
      unlocked_badges: unlockedBadges,
      promotion,
    };
  })();
}

export function listCheckins(tenantId: number, limit = 50): Checkin[] {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 500);
  return db
    .prepare('SELECT * FROM checkins WHERE tenant_id = ? ORDER BY id DESC LIMIT ?')
    .all(tenantId, safeLimit) as Checkin[];
}

export interface StreakSummary {
  task_id: number;
  title: string;
  current_streak: number;
  best_streak: number;
  last_checked_on: string | null;
}

export function listStreaks(tenantId: number): StreakSummary[] {
  return db
    .prepare(
      `SELECT t.id AS task_id,
              t.title AS title,
              COALESCE(MAX(c.streak), 0) AS best_streak,
              MAX(c.checked_on) AS last_checked_on,
              (SELECT streak FROM checkins c2
                WHERE c2.task_id = t.id AND c2.tenant_id = @tenant AND c2.is_revoked = 0
                ORDER BY c2.checked_on DESC LIMIT 1) AS current_streak
         FROM tasks t
         LEFT JOIN checkins c
           ON c.task_id = t.id AND c.tenant_id = @tenant AND c.is_revoked = 0
        WHERE t.active = 1 AND (t.tenant_id IS NULL OR t.tenant_id = @tenant)
        GROUP BY t.id
        ORDER BY t.id ASC`,
    )
    .all({ tenant: tenantId }) as StreakSummary[];
}

export interface RevokeResult {
  checkin: Checkin;
  reversed_amount: number;
  liquid_balance: number;
}

/**
 * Atomically revoke a check-in and reverse every credit it produced.
 * Writes a negative ledger entry and deducts the child's liquid balance.
 */
export function revokeCheckin(adminId: number, checkinId: number): RevokeResult {
  return db.transaction(() => {
    const checkin = db
      .prepare('SELECT * FROM checkins WHERE id = ?')
      .get(checkinId) as Checkin | undefined;
    if (!checkin) throw new HttpError(404, 'Check-in not found');
    if (checkin.is_revoked) throw new HttpError(409, '该打卡已被撤销');

    // Reverse the base reward plus any streak bonus tied to this check-in.
    const bonusRow = db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS bonus FROM transactions
          WHERE ref_table = 'checkins' AND ref_id = ? AND type = 'streak_bonus'`,
      )
      .get(checkinId) as { bonus: number };

    const reversed = round2(checkin.credit_awarded + bonusRow.bonus);

    db.prepare(
      `UPDATE checkins
          SET is_revoked = 1, revoked_at = datetime('now'), revoked_by = ?
        WHERE id = ?`,
    ).run(adminId, checkinId);

    adjustLiquid(checkin.tenant_id, -reversed);
    recordTransaction(checkin.tenant_id, 'revoke_adjustment', -reversed, {
      refTable: 'checkins',
      refId: checkinId,
      note: `打卡 #${checkinId} 已由家长撤销`,
    });

    const updated = db
      .prepare('SELECT * FROM checkins WHERE id = ?')
      .get(checkinId) as Checkin;

    return {
      checkin: updated,
      reversed_amount: reversed,
      liquid_balance: getAccount(checkin.tenant_id).liquid_balance,
    };
  })();
}
