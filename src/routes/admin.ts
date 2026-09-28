import { Router } from 'express';
import * as adminController from '../controllers/adminController';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  adjustChildSchema,
  createAdminTaskSchema,
  setTaskActiveSchema,
} from '../schemas';

export const adminRouter = Router();

// Every route below requires a PARENT (global admin) token.
adminRouter.use(authMiddleware, requireAdmin);

// Children dashboards
adminRouter.get('/children', adminController.listChildren);
adminRouter.get('/children/:id', adminController.childDetail);
adminRouter.get('/children/:id/transactions', adminController.childTransactions);
adminRouter.post('/children/:id/adjust', validate(adjustChildSchema), adminController.adjustChild);

// Task management (global or per-child)
adminRouter.get('/tasks', adminController.listTasks);
adminRouter.post('/tasks', validate(createAdminTaskSchema), adminController.createTask);
adminRouter.patch('/tasks/:id', validate(setTaskActiveSchema), adminController.setTaskActive);

// Check-in revocation with ledger reversal
adminRouter.post('/check-in/:id/revoke', adminController.revokeCheckin);
