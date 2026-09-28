import { Router } from 'express';
import { taskRouter } from './tasks';
import { proposalRouter } from './proposals';
import { assetRouter } from './assets';
import { financialRouter } from './financial';
import { memberRouter } from './auth';
import { adminRouter } from './admin';
import { gamificationRouter } from './gamification';

export const apiRouter = Router();

apiRouter.use('/admin', adminRouter);
apiRouter.use('/members', memberRouter);
apiRouter.use('/tasks', taskRouter);
apiRouter.use('/proposals', proposalRouter);
apiRouter.use('/assets', assetRouter);
apiRouter.use('/financial', financialRouter);
apiRouter.use('/gamification', gamificationRouter);
