import type { Request, Response } from 'express';
import * as taskService from '../services/taskService';
import * as checkinService from '../services/checkinService';
import { HttpError } from '../utils/http';

export function listTasks(req: Request, res: Response): void {
  res.json({ tasks: taskService.listTasks(req.tenantId!) });
}

export function createTask(req: Request, res: Response): void {
  const task = taskService.createTask(req.tenantId!, {
    title: req.body?.title,
    description: req.body?.description ?? null,
    kind: req.body?.kind,
    base_credit: req.body?.base_credit,
  });
  res.status(201).json({ task });
}

export function archiveTask(req: Request, res: Response): void {
  const taskId = Number(req.params.id);
  if (!Number.isInteger(taskId)) throw new HttpError(400, 'invalid task id');
  taskService.adminSetTaskActive(taskId, false);
  res.status(204).end();
}

export function checkin(req: Request, res: Response): void {
  const taskId = Number(req.params.id ?? req.body?.task_id);
  if (!Number.isInteger(taskId)) throw new HttpError(400, 'task id is required');
  const result = checkinService.completeCheckin(req.tenantId!, {
    taskId,
    proof: req.body?.proof ?? null,
    note: req.body?.note ?? null,
  });
  res.status(201).json(result);
}

export function listCheckins(req: Request, res: Response): void {
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  res.json({ checkins: checkinService.listCheckins(req.tenantId!, limit) });
}

export function listStreaks(req: Request, res: Response): void {
  res.json({ streaks: checkinService.listStreaks(req.tenantId!) });
}
