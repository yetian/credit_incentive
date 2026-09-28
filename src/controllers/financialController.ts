import type { Request, Response } from 'express';
import { getAccount, listTransactions } from '../services/accountService';
import * as savings from '../services/savingsService';
import * as loans from '../services/loanService';
import { getTenant } from '../services/authService';
import { evaluateBadges } from '../services/badgeService';
import { evaluateRole } from '../services/roleService';
import { HttpError } from '../utils/http';

export function getAccountSummary(req: Request, res: Response): void {
  const tenant = getTenant(req.tenantId!);
  res.json({
    account: getAccount(req.tenantId!),
    credit_score: tenant.credit_score,
    loan_limit: loans.maxLoanAmount(tenant.credit_score),
  });
}

export function depositSavings(req: Request, res: Response): void {
  const account = savings.depositToSavings(req.tenantId!, req.body?.amount);
  res.json({ account });
}

export function withdrawSavings(req: Request, res: Response): void {
  const account = savings.withdrawFromSavings(req.tenantId!, req.body?.amount);
  res.json({ account });
}

export function accrueSavings(req: Request, res: Response): void {
  const period = req.body?.period as string | undefined;
  const result = savings.accrueInterestForTenant(req.tenantId!, period);
  res.json(result);
}

export function accrueAll(req: Request, res: Response): void {
  const period = req.body?.period as string | undefined;
  res.json({ results: savings.accrueInterestForAll(period) });
}

export function listSavingsAccruals(req: Request, res: Response): void {
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  res.json({ accruals: savings.listAccruals(req.tenantId!, limit) });
}

export function listTransactionsHandler(req: Request, res: Response): void {
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  res.json({ transactions: listTransactions(req.tenantId!, limit) });
}

export function listLoans(_req: Request, res: Response): void {
  res.json({ loans: loans.listLoans(_req.tenantId!) });
}

export function requestLoan(req: Request, res: Response): void {
  const result = loans.requestLoan(
    req.tenantId!,
    req.body?.principal,
    req.body?.due_date ?? null,
  );
  res.status(201).json(result);
}

export function repayLoan(req: Request, res: Response): void {
  const loanId = Number(req.params.id);
  if (!Number.isInteger(loanId)) throw new HttpError(400, 'invalid loan id');
  const result = loans.repayLoan(req.tenantId!, loanId, req.body?.amount);
  const unlocked = evaluateBadges(req.tenantId!);
  const promotion = evaluateRole(req.tenantId!);
  res.json({ ...result, unlocked_badges: unlocked, promotion });
}

export function accrueLoan(req: Request, res: Response): void {
  const loanId = Number(req.params.id);
  if (!Number.isInteger(loanId)) throw new HttpError(400, 'invalid loan id');
  const result = loans.accrueLoanInterest(req.tenantId!, loanId, req.body?.period);
  res.json(result);
}

export function accrueAllLoans(_req: Request, res: Response): void {
  res.json({ results: loans.accrueInterestForAllLoans(_req.body?.period) });
}

export function markOverdue(_req: Request, res: Response): void {
  res.json({ defaulted: loans.markOverdueLoans() });
}

export function listLoanAccruals(req: Request, res: Response): void {
  const loanId = Number(req.params.id);
  if (!Number.isInteger(loanId)) throw new HttpError(400, 'invalid loan id');
  res.json({ accruals: loans.listLoanAccruals(req.tenantId!, loanId) });
}
