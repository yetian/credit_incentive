import { config } from '../config';
import { db } from '../db';
import {
  adjustLiquid,
  adjustSavings,
  getAccount,
  recordTransaction,
} from './accountService';
import { HttpError, assertPositive, isoWeekKey, round2 } from '../utils/http';
import type { Account, Tenant } from '../models/types';

export function depositToSavings(tenantId: number, rawAmount: number): Account {
  const amount = assertPositive(rawAmount, 'amount');
  return db.transaction(() => {
    const account = getAccount(tenantId);
    if (account.liquid_balance < amount) {
      throw new HttpError(400, 'Insufficient liquid credit', {
        available: account.liquid_balance,
      });
    }
    adjustLiquid(tenantId, -amount);
    adjustSavings(tenantId, amount);
    recordTransaction(tenantId, 'savings_deposit', -amount, {
      refTable: 'tenants',
      refId: tenantId,
      note: 'transfer liquid -> savings',
    });
    return getAccount(tenantId);
  })();
}

export function withdrawFromSavings(tenantId: number, rawAmount: number): Account {
  const amount = assertPositive(rawAmount, 'amount');
  return db.transaction(() => {
    const account = getAccount(tenantId);
    if (account.savings_balance < amount) {
      throw new HttpError(400, 'Insufficient savings balance', {
        available: account.savings_balance,
      });
    }
    adjustSavings(tenantId, -amount);
    adjustLiquid(tenantId, amount);
    recordTransaction(tenantId, 'savings_withdraw', amount, {
      refTable: 'tenants',
      refId: tenantId,
      note: 'transfer savings -> liquid',
    });
    return getAccount(tenantId);
  })();
}

export interface AccrualResult {
  tenant_id: number;
  period: string;
  principal: number;
  rate: number;
  interest: number;
  savings_balance: number;
}

export function periodRate(): number {
  return config.savings.annualRate / config.savings.periodsPerYear;
}

export function accrueInterestForTenant(
  tenantId: number,
  period: string = isoWeekKey(),
): AccrualResult {
  return db.transaction(() => {
    const account = getAccount(tenantId);
    const rate = periodRate();

    const already = db
      .prepare('SELECT id FROM savings_accruals WHERE tenant_id = ? AND period = ?')
      .get(tenantId, period) as { id: number } | undefined;
    if (already) {
      throw new HttpError(409, `Interest already accrued for period ${period}`);
    }

    const principal = account.savings_balance;
    const interest = principal > 0 ? round2(principal * rate) : 0;

    db.prepare(
      'INSERT INTO savings_accruals (tenant_id, period, principal, rate, interest) VALUES (?, ?, ?, ?, ?)',
    ).run(tenantId, period, principal, rate, interest);

    if (interest > 0) {
      adjustSavings(tenantId, interest);
      recordTransaction(tenantId, 'interest', interest, {
        refTable: 'savings_accruals',
        refId: tenantId,
        note: `compound period ${period}`,
      });
    }

    return {
      tenant_id: tenantId,
      period,
      principal,
      rate,
      interest,
      savings_balance: getAccount(tenantId).savings_balance,
    };
  })();
}

export function accrueInterestForAll(period: string = isoWeekKey()): AccrualResult[] {
  const tenants = db.prepare('SELECT id FROM tenants').all() as Pick<Tenant, 'id'>[];
  const results: AccrualResult[] = [];

  for (const tenant of tenants) {
    try {
      results.push(accrueInterestForTenant(tenant.id, period));
    } catch (error) {
      if (error instanceof HttpError && error.status === 409) continue;
      throw error;
    }
  }
  return results;
}

export function listAccruals(tenantId: number, limit = 50): unknown[] {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 500);
  return db
    .prepare(
      'SELECT * FROM savings_accruals WHERE tenant_id = ? ORDER BY id DESC LIMIT ?',
    )
    .all(tenantId, safeLimit);
}
