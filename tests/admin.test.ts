import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { adminActor, app, authHeader, seedTenant } from './helpers';
import { db } from '../src/db';

async function setupChildWithCheckin() {
  const admin = await adminActor();
  const child = seedTenant('Kiddo');
  const childHeader = await authHeader(child);

  const task = await request(app)
    .post('/api/admin/tasks')
    .set('Authorization', admin.header)
    .send({ title: 'Sweep', base_credit: 20, child_id: child });

  const checkin = await request(app)
    .post(`/api/tasks/${task.body.task.id}/checkin`)
    .set('Authorization', childHeader)
    .send({});
  return { parent: admin.id, parentHeader: admin.header, child, childHeader, checkinId: checkin.body.checkin.id };
}

describe('admin: check-in revocation & reversal', () => {
  it('reverses credit atomically and writes a negative ledger entry', async () => {
    const { parentHeader, childHeader, child, checkinId } = await setupChildWithCheckin();

    const before = (await request(app).get('/api/financial/account').set('Authorization', childHeader))
      .body.account.liquid_balance;
    expect(before).toBeGreaterThan(0);

    const res = await request(app)
      .post(`/api/admin/check-in/${checkinId}/revoke`)
      .set('Authorization', parentHeader);
    expect(res.status).toBe(200);
    expect(res.body.reversed_amount).toBeGreaterThan(0);
    expect(res.body.checkin.is_revoked).toBe(1);

    const after = (await request(app).get('/api/financial/account').set('Authorization', childHeader))
      .body.account.liquid_balance;
    expect(after).toBeCloseTo(before - res.body.reversed_amount);

    const ledger = db
      .prepare(
        "SELECT * FROM transactions WHERE tenant_id = ? AND type = 'revoke_adjustment' ORDER BY id DESC LIMIT 1",
      )
      .get(child) as { amount: number } | undefined;
    expect(ledger?.amount).toBeLessThan(0);
  });

  it('rejects a second revocation', async () => {
    const { parentHeader, checkinId } = await setupChildWithCheckin();
    await request(app).post(`/api/admin/check-in/${checkinId}/revoke`).set('Authorization', parentHeader);
    const second = await request(app)
      .post(`/api/admin/check-in/${checkinId}/revoke`)
      .set('Authorization', parentHeader);
    expect(second.status).toBe(409);
  });

  it('forbids non-parents from revoking', async () => {
    const { childHeader, checkinId } = await setupChildWithCheckin();
    const res = await request(app)
      .post(`/api/admin/check-in/${checkinId}/revoke`)
      .set('Authorization', childHeader);
    expect(res.status).toBe(403);
  });
});

describe('admin: children dashboard, task & balance management', () => {
  it('returns children dashboards to parents', async () => {
    const admin = await adminActor('Boss');
    seedTenant('Junior');
    const res = await request(app).get('/api/admin/children').set('Authorization', admin.header);
    expect(res.status).toBe(200);
    expect(res.body.children.length).toBeGreaterThan(0);
    expect(res.body.children[0].account).toBeDefined();
  });

  it('lets a parent create a task for a specific child', async () => {
    const admin = await adminActor('Director');
    const child = seedTenant('Worker');
    const res = await request(app)
      .post('/api/admin/tasks')
      .set('Authorization', admin.header)
      .send({ title: 'Homework', base_credit: 15, child_id: child });
    expect(res.status).toBe(201);
    expect(res.body.task.tenant_id).toBe(child);
  });

  it('adjusts a child balance and credit score', async () => {
    const admin = await adminActor('Banker');
    const child = seedTenant('Spender');

    const res = await request(app)
      .post(`/api/admin/children/${child}/adjust`)
      .set('Authorization', admin.header)
      .send({ liquid_delta: 50, credit_score: 700 });
    expect(res.status).toBe(200);
    expect(res.body.account.liquid_balance).toBe(50);
    expect(res.body.tenant.credit_score).toBe(700);
  });
});
