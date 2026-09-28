import { Router } from 'express';
import * as taskController from '../controllers/taskController';
import { requireAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { checkinSchema, createTaskSchema } from '../schemas';

export const taskRouter = Router();

// Children can view tasks and check in.
taskRouter.get('/', taskController.listTasks);
taskRouter.get('/streaks', taskController.listStreaks);
taskRouter.get('/checkins', taskController.listCheckins);
taskRouter.post('/:id/checkin', validate(checkinSchema), taskController.checkin);
taskRouter.post('/checkin', validate(checkinSchema), taskController.checkin);

// Only parents define tasks and rewards.
taskRouter.post('/', requireAdmin, validate(createTaskSchema), taskController.createTask);
taskRouter.delete('/:id', requireAdmin, taskController.archiveTask);
