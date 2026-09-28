import { db } from '../db';
import { HttpError, round2 } from '../utils/http';
import type { Task, TaskKind } from '../models/types';

export interface TaskInput {
  title: string;
  description?: string | null;
  kind?: TaskKind;
  base_credit: number;
  tenant_id?: number | null;
}

export function listTasks(tenantId: number, includeGlobals = true): Task[] {
  if (includeGlobals) {
    return db
      .prepare(
        `SELECT * FROM tasks
          WHERE active = 1 AND (tenant_id IS NULL OR tenant_id = ?)
          ORDER BY kind ASC, id ASC`,
      )
      .all(tenantId) as Task[];
  }
  return db
    .prepare('SELECT * FROM tasks WHERE active = 1 AND tenant_id = ? ORDER BY id ASC')
    .all(tenantId) as Task[];
}

export function getTask(taskId: number): Task {
  const task = db
    .prepare('SELECT * FROM tasks WHERE id = ?')
    .get(taskId) as Task | undefined;
  if (!task) throw new HttpError(404, 'Task not found');
  return task;
}

export function createTask(tenantId: number, input: TaskInput): Task {
  const title = (input.title ?? '').trim();
  if (!title) throw new HttpError(400, 'title is required');

  const baseCredit = Number(input.base_credit);
  if (!Number.isFinite(baseCredit) || baseCredit <= 0) {
    throw new HttpError(400, 'base_credit must be > 0');
  }

  const kind: TaskKind = input.kind === 'bounty' ? 'bounty' : 'habit';
  // Admins may target a specific child (or null for a global task).
  const owner = input.tenant_id === undefined ? tenantId : input.tenant_id;

  const info = db
    .prepare(
      `INSERT INTO tasks (tenant_id, title, description, kind, base_credit)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      owner,
      title,
      input.description ?? null,
      kind,
      round2(baseCredit),
    );

  return getTask(Number(info.lastInsertRowid));
}

export function archiveTask(tenantId: number, taskId: number): void {
  const task = getTask(taskId);
  if (task.tenant_id !== tenantId) {
    throw new HttpError(403, 'Only the task owner can archive a task');
  }
  db.prepare('UPDATE tasks SET active = 0 WHERE id = ?').run(taskId);
}

/** Admin view: every task, including archived ones. */
export function listAllTasks(): Task[] {
  return db.prepare('SELECT * FROM tasks ORDER BY active DESC, id DESC').all() as Task[];
}

/** Admin override: archive/modify a task regardless of owner. */
export function adminSetTaskActive(taskId: number, active: boolean): Task {
  getTask(taskId);
  db.prepare('UPDATE tasks SET active = ? WHERE id = ?').run(active ? 1 : 0, taskId);
  return getTask(taskId);
}
