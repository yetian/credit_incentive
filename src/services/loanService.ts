import { config } from '../config';
import { db } from '../db';
import { adjustLiquid, getAccount, recordTransaction } from './accountService';
import { getTenant } from './authService';
import { HttpError, assertPositive, isoWeekKey, round2 } from '../utils/http';
import type { Loan, LoanAccrual, LoanRepayment, Tenant } from '../models/types';

function clampScore(score: number): number {
  return Math.round(
    Math.min(Math.max(score, config.loan.creditScoreMin), config.loan.creditScoreMax),
  );
}

export function updateCreditScore(tenantId: number, delta: number): Tenant {
  const tenant = getTenant(tenantId);
  const next = clampScore(tenant.credit_score + delta);
  db.prepare('UPDATE tenants SET credit_score = ? WHERE id = ?').run(next, tenantId);
  return getTenant(tenantId);
}

export function setCreditScore(tenantId: number, score: number): Tenant {
  getTenant(tenantId);
  const next = clampScore(Number(score));
  db.prepare('UPDATE tenants SET credit_score = ? WHERE id = ?').run(next, tenantId);
  return getTenant(tenantId);
}

export function maxLoanAmount(creditScore: number): number {
  return round2(Math.max(0, creditScore) * config.loan.creditPerScore);
}

export function listLoans(tenantId: number): Loan[] {
  return db
    .prepare('SELECT * FROM loans WHERE tenant_id = ? ORDER BY id DESC')
    .all(tenantId) as Loan[];
}

export function getLoan(tenantId: number, loanId: number): Loan {
  const loan = db
    .prepare('SELECT * FROM loans WHERE id = ? AND tenant_id = ?')
    .get(loanId, tenantId) as Loan | undefined;
  if (!loan) throw new HttpError(404, 'Loan not found');
  return loan;
}

export function requestLoan(
  tenantId: number,
  rawPrincipal: number,
  dueDate?: string | null,
): { loan: Loan; balance: number; credit_score: number; limit: number } {
  const principal = assertPositive(rawPrincipal, 'principal');

  return db.transaction(() => {
    const tenant = getTenant(tenantId);
    const limit = maxLoanAmount(tenant.credit_score);
    if (principal > limit) {
      throw new HttpError(400, 'Loan exceeds credit limit', {
        requested: principal,
        limit,
        credit_score: tenant.credit_score,
      });
    }

    const info = db
      .prepare(
        `INSERT INTO loans (tenant_id, principal, annual_rate, outstanding, status, due_date)
         VALUES (?, ?, ?, ?, 'active', ?)`,
      )
      .run(tenantId, principal, config.loan.annualRate, principal, dueDate ?? null);

    const loanId = Number(info.lastInsertRowid);
    adjustLiquid(tenantId, principal);
    recordTransaction(tenantId, 'loan_disbursement', principal, {
      refTable: 'loans',
      refId: loanId,
      note: `loan #${loanId}`,
    });

    return {
      loan: getLoan(tenantId, loanId),
      balance: getAccount(tenantId).liquid_balance,
      credit_score: tenant.credit_score,
      limit,
    };
  })();
}

export function repayLoan(
  tenantId: number,
  loanId: number,
  rawAmount: number,
): {
  loan: Loan;
  repayment: LoanRepayment;
  paid: number;
  balance: number;
  credit_score: number;
} {
  const amount = assertPositive(rawAmount, 'amount');

  return db.transaction(() => {
    const loan = getLoan(tenantId, loanId);
    if (loan.status !== 'active') {
      throw new HttpError(400, `Loan is ${loan.status}`);
    }

    const account = getAccount(tenantId);
    if (account.liquid_balance < amount) {
      throw new HttpError(400, 'Insufficient liquid credit', {
        available: account.liquid_balance,
      });
    }

    const paid = round2(Math.min(amount, loan.outstanding));
    const outstanding = round2(loan.outstanding - paid);
    const status = outstanding <= 0 ? 'repaid' : 'active';

    adjustLiquid(tenantId, -paid);
    db.prepare('UPDATE loans SET outstanding = ?, status = ? WHERE id = ?').run(
      outstanding,
      status,
      loanId,
    );

    const repInfo = db
      .prepare(
        'INSERT INTO loan_repayments (loan_id, tenant_id, amount) VALUES (?, ?, ?)',
      )
      .run(loanId, tenantId, paid);

    recordTransaction(tenantId, 'loan_repayment', -paid, {
      refTable: 'loans',
      refId: loanId,
      note: `repay loan #${loanId}`,
    });

    // Repaying builds trust; full repayment grants a completion bonus.
    const ratio = paid / loan.principal;
    let scoreDelta = Math.max(1, Math.round(ratio * 20));
    if (status === 'repaid') scoreDelta += 25;
    const tenant = updateCreditScore(tenantId, scoreDelta);

    const repayment = db
      .prepare('SELECT * FROM loan_repayments WHERE id = ?')
      .get(Number(repInfo.lastInsertRowid)) as LoanRepayment;

    return {
      loan: getLoan(tenantId, loanId),
      repayment,
      paid,
      balance: getAccount(tenantId).liquid_balance,
      credit_score: tenant.credit_score,
    };
  })();
}

export function periodRate(): number {
  return config.loan.annualRate / config.loan.periodsPerYear;
}

export interface LoanAccrualResult {
  loan_id: number;
  tenant_id: number;
  period: string;
  principal: number;
  rate: number;
  interest: number;
  outstanding: number;
}

export function accrueLoanInterest(
  tenantId: number,
  loanId: number,
  period: string = isoWeekKey(),
): LoanAccrualResult {
  return db.transaction(() => {
    const loan = getLoan(tenantId, loanId);
    if (loan.status !== 'active') {
      throw new HttpError(400, `Loan is ${loan.status}`);
    }

    const already = db
      .prepare('SELECT id FROM loan_accruals WHERE loan_id = ? AND period = ?')
      .get(loanId, period);
    if (already) {
      throw new HttpError(409, `Interest already accrued for period ${period}`);
    }

    const rate = periodRate();
    const interest = round2(loan.outstanding * rate);

    db.prepare(
      'INSERT INTO loan_accruals (loan_id, tenant_id, period, principal, rate, interest) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(loanId, tenantId, period, loan.outstanding, rate, interest);

    db.prepare(
      `UPDATE loans
          SET outstanding = ROUND(outstanding + ?, 2),
              periods_accrued = periods_accrued + 1,
              last_accrual_at = datetime('now')
        WHERE id = ?`,
    ).run(interest, loanId);

    recordTransaction(tenantId, 'loan_interest', interest, {
      refTable: 'loan_accruals',
      refId: loanId,
      note: `loan #${loanId} interest ${period} (+${interest} 债务)`,
    });

    const updated = getLoan(tenantId, loanId);
    return {
      loan_id: loanId,
      tenant_id: tenantId,
      period,
      principal: loan.outstanding,
      rate,
      interest,
      outstanding: updated.outstanding,
    };
  })();
}

export function accrueInterestForAllLoans(period: string = isoWeekKey()): LoanAccrualResult[] {
  const loans = db
    .prepare("SELECT id, tenant_id FROM loans WHERE status = 'active'")
    .all() as { id: number; tenant_id: number }[];
  const results: LoanAccrualResult[] = [];

  for (const loan of loans) {
    try {
      results.push(accrueLoanInterest(loan.tenant_id, loan.id, period));
    } catch (error) {
      if (error instanceof HttpError && error.status === 409) continue;
      throw error;
    }
  }
  return results;
}

export interface OverdueResult {
  loan_id: number;
  tenant_id: number;
  outstanding: number;
  credit_score: number;
}

export function markOverdueLoans(today: string = new Date().toISOString().slice(0, 10)): OverdueResult[] {
  const overdue = db
    .prepare(
      `SELECT * FROM loans
        WHERE status = 'active' AND due_date IS NOT NULL AND due_date < ?`,
    )
    .all(today) as Loan[];

  const results: OverdueResult[] = [];
  for (const loan of overdue) {
    db.prepare("UPDATE loans SET status = 'defaulted' WHERE id = ?").run(loan.id);
    const tenant = updateCreditScore(loan.tenant_id, -config.loan.defaultPenalty);
    recordTransaction(loan.tenant_id, 'adjustment', 0, {
      refTable: 'loans',
      refId: loan.id,
      note: `逾期违约，信用分 -${config.loan.defaultPenalty}`,
    });
    results.push({
      loan_id: loan.id,
      tenant_id: loan.tenant_id,
      outstanding: loan.outstanding,
      credit_score: tenant.credit_score,
    });
  }
  return results;
}

export function listLoanAccruals(tenantId: number, loanId: number): LoanAccrual[] {
  return db
    .prepare('SELECT * FROM loan_accruals WHERE tenant_id = ? AND loan_id = ? ORDER BY id DESC')
    .all(tenantId, loanId) as LoanAccrual[];
}
