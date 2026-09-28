import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { adminActor, app, authHeader, seedTenant } from './helpers';

describe('auth & tenant isolation', () => {
  it('rejects requests without a token', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
  });

  it('issues a token and returns the profile', async () => {
    const id = seedTenant('Alice');
    const header = await authHeader(id);
    const res = await request(app).get('/api/gamification/profile').set('Authorization', header);
    expect(res.status).toBe(200);
    expect(res.body.tenant.id).toBe(id);
    expect(res.body.account.liquid_balance).toBe(0);
  });

  it('isolates tenant-owned tasks', async () => {
    const admin = await adminActor();
    const a = seedTenant('A');
    const b = seedTenant('B');
    const headerB = await authHeader(b);

    await request(app)
      .post('/api/admin/tasks')
      .set('Authorization', admin.header)
      .send({ title: 'A-only', base_credit: 5, child_id: a })
      .expect(201);

    const listB = await request(app).get('/api/tasks').set('Authorization', headerB);
    expect(listB.body.tasks).toHaveLength(0);
  });

  it('does not let children create tasks', async () => {
    const child = seedTenant('NoRights');
    const header = await authHeader(child);
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', header)
      .send({ title: 'self-task', base_credit: 5 });
    expect(res.status).toBe(403);
  });

  it('lets only PARENT create members', async () => {
    const child = seedTenant('Child');
    const admin = await adminActor('Parent');

    const childHeader = await authHeader(child);
    const denied = await request(app)
      .post('/api/members')
      .set('Authorization', childHeader)
      .send({ name: 'Kid' });
    expect(denied.status).toBe(403);

    const ok = await request(app)
      .post('/api/members')
      .set('Authorization', admin.header)
      .send({ name: 'Kid2' });
    expect(ok.status).toBe(201);
  });

  it('requires a valid PIN to obtain a PARENT token', async () => {
    const parent = seedTenant('Papa', { role: 'PARENT', pin_code: '9999' });

    const noPin = await request(app).post('/api/auth/token').send({ tenant_id: parent });
    expect(noPin.status).toBe(401);

    const wrong = await request(app)
      .post('/api/auth/token')
      .send({ tenant_id: parent, pin_code: '0000' });
    expect(wrong.status).toBe(401);

    const right = await request(app)
      .post('/api/auth/token')
      .send({ tenant_id: parent, pin_code: '9999' });
    expect(right.status).toBe(200);
    expect(right.body.tenant.role).toBe('PARENT');
  });

  it('upgrades a session to PARENT via /parent-verify', async () => {
    seedTenant('Mom', { role: 'PARENT', pin_code: '4321' });
    const res = await request(app).post('/api/auth/parent-verify').send({ pin_code: '4321' });
    expect(res.status).toBe(200);
    expect(res.body.tenant.role).toBe('PARENT');
    expect(typeof res.body.token).toBe('string');
  });

  it('validates request bodies', async () => {
    const admin = await adminActor('Validator');
    const res = await request(app)
      .post('/api/admin/tasks')
      .set('Authorization', admin.header)
      .send({ base_credit: 5 });
    expect(res.status).toBe(400);
  });
});
