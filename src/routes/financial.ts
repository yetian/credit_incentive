import { Router } from 'express';
import * as financialController from '../controllers/financialController';
import { requireAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  amountSchema,
  periodSchema,
  repayLoanSchema,
  requestLoanSchema,
} from '../schemas';

export const financialRouter = Router();

financialRouter.get('/account', financialController.getAccountSummary);
financialRouter.get('/transactions', financialController.listTransactionsHandler);

financialRouter.post('/savings/deposit', validate(amountSchema), financialController.depositSavings);
financialRouter.post('/savings/withdraw', validate(amountSchema), financialController.withdrawSavings);
financialRouter.post('/savings/accrue', validate(periodSchema), financialController.accrueSavings);
financialRouter.get('/savings/accruals', financialController.listSavingsAccruals);
financialRouter.post(
  '/savings/accrue-all',
  requireAdmin,
  validate(periodSchema),
  financialController.accrueAll,
);

financialRouter.get('/loans', financialController.listLoans);
financialRouter.post('/loans', validate(requestLoanSchema), financialController.requestLoan);
financialRouter.post('/loans/:id/repay', validate(repayLoanSchema), financialController.repayLoan);
financialRouter.get('/loans/:id/accruals', financialController.listLoanAccruals);
financialRouter.post('/loans/:id/accrue', validate(periodSchema), financialController.accrueLoan);
financialRouter.post(
  '/loans/accrue-all',
  requireAdmin,
  validate(periodSchema),
  financialController.accrueAllLoans,
);
financialRouter.post('/loans/overdue/run', requireAdmin, financialController.markOverdue);
