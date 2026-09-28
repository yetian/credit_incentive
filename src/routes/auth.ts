import { Router } from 'express';
import * as authController from '../controllers/authController';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createMemberSchema,
  issueTokenSchema,
  parentVerifySchema,
  updateRoleSchema,
} from '../schemas';

export const authRouter = Router();

authRouter.get('/tenants', authController.listTenants);
authRouter.post('/token', validate(issueTokenSchema), authController.issueToken);
authRouter.post('/parent-verify', validate(parentVerifySchema), authController.parentVerify);
authRouter.get('/me', authMiddleware, authController.me);

// Member management is admin-only.
export const memberRouter = Router();
memberRouter.use(authMiddleware, requireAdmin);
memberRouter.get('/', authController.listTenants);
memberRouter.post('/', validate(createMemberSchema), authController.createMember);
memberRouter.patch('/:id/role', validate(updateRoleSchema), authController.updateRole);
