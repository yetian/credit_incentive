import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { adminActor, app, authHeader, seedTenant } from './helpers';
import { db } from '../src/db';

async function makeTask(tenantId: number, base = 10): Promise<number> {
  const admin = await adminActor();
  const res = await request(app)
    .post('/api/admin/tasks')
    .set('Authorization', admin.header)
    .send({ title: 'Read', base_credit: base, child_id: tenantId });
  return res.body.task.id;
}

describe('check-in rewards, streak & badges', () => {
  it('awards base credit and unlocks the first-checkin badge', async () => {
    const id = seedTenant('Kid');
    const taskId = await makeTask(id, 10);
    const header = await authHeader(id);

    const res = await request(app)
      .post(`/api/tasks/${taskId}/checkin`)
      .set('Authorization', header)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.credit_awarded).toBe(10);
    expect(res.body.liquid_balance).toBe(20); // 10 credit + 10 badge reward
    expect(res.body.unlocked_badges.map((b: { code: string }) => b.code)).toContain('first_checkin');
  });

  it('blocks a second check-in on the same day', async () => {
    const id = seedTenant('Kid2');
    const taskId = await makeTask(id);
    const header = await authHeader(id);
    await request(app).post(`/api/tasks/${taskId}/checkin`).set('Authorization', header).send({});
    const res = await request(app)
      .post(`/api/tasks/${taskId}/checkin`)
      .set('Authorization', header)
      .send({});
    expect(res.status).toBe(409);
  });

  it('applies the asset multiplier to rewards', async () => {
    const id = seedTenant('Rich');
    const header = await authHeader(id);
    // give credit and buy the 1.10x asset
    db.prepare('UPDATE accounts SET liquid_balance = 100 WHERE tenant_id = ?').run(id);
    await request(app).post('/api/assets/1/purchase').set('Authorization', header).expect(200);

    const taskId = await makeTask(id, 10);
    const res = await request(app)
      .post(`/api/tasks/${taskId}/checkin`)
      .set('Authorization', header)
      .send({});
    expect(res.body.credit_awarded).toBeCloseTo(11);
    expect(res.body.multiplier_applied).toBeCloseTo(1.1);
  });

  it('grants a streak bonus at a 7-day milestone', async () => {
    const id = seedTenant('Streaker');
    const taskId = await makeTask(id, 10);
    const header = await authHeader(id);
    await request(app).post(`/api/tasks/${taskId}/checkin`).set('Authorization', header).send({});

    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    db.prepare('UPDATE checkins SET checked_on = ?, streak = 6 WHERE tenant_id = ?').run(
      yesterday.toISOString().slice(0, 10),
      id,
    );

    const res = await request(app)
      .post(`/api/tasks/${taskId}/checkin`)
      .set('Authorization', header)
      .send({});
    expect(res.body.streak).toBe(7);
    expect(res.body.streak_bonus).toBe(5);
  });
});
