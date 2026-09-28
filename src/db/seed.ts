import { db } from './index';
import { createTenant } from '../services/authService';

function seed(): void {
  const count = db.prepare('SELECT COUNT(*) AS n FROM tenants').get() as { n: number };
  if (count.n > 0) {
    console.log('[seed] tenants already exist, skipping');
    return;
  }

  const parent = createTenant({
    name: '家长 (Admin)',
    role: 'PARENT',
    game_role: 'ceo',
    credit_score: 900,
  });
  const child = createTenant({
    name: '孩子 (Child)',
    role: 'CHILD',
    game_role: 'employee',
    credit_score: 500,
  });

  db.prepare(
    `INSERT INTO tasks (tenant_id, title, description, kind, base_credit)
     VALUES (?, ?, ?, 'habit', ?)`,
  ).run(child.id, '刷牙', '早晚各一次', 2);

  db.prepare(
    `INSERT INTO tasks (tenant_id, title, description, kind, base_credit)
     VALUES (?, ?, ?, 'habit', ?)`,
  ).run(child.id, '阅读 30 分钟', '每日阅读', 5);

  db.prepare(
    `INSERT INTO tasks (tenant_id, title, description, kind, base_credit)
     VALUES (?, ?, ?, 'bounty', ?)`,
  ).run(parent.id, '整理书架', '悬赏任务，一次性', 20);

  console.log('[seed] created tenants:', { parent: parent.id, child: child.id });
}

seed();
