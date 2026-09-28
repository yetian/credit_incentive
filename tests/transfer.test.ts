import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { adminActor, app, authHeader, seedTenant } from './helpers';
import { db } from '../src/db';

function fund(tenantId: number, amount: number): void {
  db.prepare('UPDATE accounts SET liquid_balance = ? WHERE tenant_id = ?').run(amount, tenantId);
}

describe('assets: store managed by parents, redeemed by children', () => {
  it('transfers ownership and pays the seller', async () => {
    const admin = await adminActor();
    const seller = seedTenant('Seller');
    const buyer = seedTenant('Buyer');
    const buyerHeader = await authHeader(buyer);
    fund(seller, 500);
    fund(buyer, 500);

    // seller (child) buys a market asset (id 1)
    const sellerHeader = await authHeader(seller);
    await request(app).post('/api/assets/1/purchase').set('Authorization', sellerHeader).expect(200);

    // parent lists it at 80
    await request(app)
      .post('/api/assets/1/sell')
      .set('Authorization', admin.header)
      .send({ price: 80 })
      .expect(200);

    const before = (
      await request(app).get('/api/financial/account').set('Authorization', sellerHeader)
    ).body.account.liquid_balance;

    const buy = await request(app)
      .post('/api/assets/1/purchase')
      .set('Authorization', buyerHeader)
      .expect(200);
    expect(buy.body.asset.owner_tenant_id).toBe(buyer);
    expect(buy.body.seller_id).toBe(seller);

    const after = (
      await request(app).get('/api/financial/account').set('Authorization', sellerHeader)
    ).body.account.liquid_balance;
    expect(after - before).toBeCloseTo(80);
  });

  it('only parents can create store assets', async () => {
    const admin = await adminActor();
    const child = seedTenant('Customer');
    const childHeader = await authHeader(child);

    const denied = await request(app)
      .post('/api/assets')
      .set('Authorization', childHeader)
      .send({ name: 'Hack', price: 1, income_multiplier: 5 });
    expect(denied.status).toBe(403);

    const created = await request(app)
      .post('/api/assets')
      .set('Authorization', admin.header)
      .send({ name: '钢琴课', price: 30, income_multiplier: 1.2 });
    expect(created.status).toBe(201);

    fund(child, 500);
    const res = await request(app)
      .post(`/api/assets/${created.body.asset.id}/purchase`)
      .set('Authorization', childHeader);
    expect(res.body.unlocked_badges.map((b: { code: string }) => b.code)).toContain('first_asset');
  });
});
