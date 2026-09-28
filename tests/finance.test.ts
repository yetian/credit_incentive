import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, authHeader, seedTenant } from './helpers';
import { db } from '../src/db';

function fund(tenantId: number, amount: number): void {
  db.prepare('UPDATE accounts SET liquid_balance = ? WHERE tenant_id = ?').run(amount, tenantId);
}

describe('finance: savings & loans', () => {
  it('moves credit between liquid and savings', async () => {
    const id = seedTenant('Saver');
    const header = await authHeader(id);
    fund(id, 100);

    let res = await request(app)
      .post('/api/financial/savings/deposit')
      .set('Authorization', header)
      .send({ amount: 40 });
    expect(res.body.account.savings_balance).toBe(40);
    expect(res.body.account.liquid_balance).toBe(60);

    res = await request(app)
      .post('/api/financial/savings/withdraw')
      .set('Authorization', header)
      .send({ amount: 10 });
    expect(res.body.account.savings_balance).toBe(30);
    expect(res.body.account.liquid_balance).toBe(70);
  });

  it('rejects overdrafts', async () => {
    const id = seedTenant('Poor');
    const header = await authHeader(id);
    const res = await request(app)
      .post('/api/financial/savings/deposit')
      .set('Authorization', header)
      .send({ amount: 10 });
    expect(res.status).toBe(400);
  });

  it('compounds savings once per period', async () => {
    const id = seedTenant('Compound');
    const header = await authHeader(id);
    fund(id, 200);
    await request(app)
      .post('/api/financial/savings/deposit')
      .set('Authorization', header)
      .send({ amount: 200 });

    const first = await request(app)
      .post('/api/financial/savings/accrue')
      .set('Authorization', header)
      .send({ period: '2024-W01' });
    expect(first.status).toBe(200);
    expect(first.body.interest).toBeGreaterThan(0);

    const second = await request(app)
      .post('/api/financial/savings/accrue')
      .set('Authorization', header)
      .send({ period: '2024-W01' });
    expect(second.status).toBe(409);
  });

  it('enforces the credit-score loan limit and rewards repayment', async () => {
    const id = seedTenant('Borrower');
    const header = await authHeader(id);

    const tooBig = await request(app)
      .post('/api/financial/loans')
      .set('Authorization', header)
      .send({ principal: 9999 });
    expect(tooBig.status).toBe(400);

    const loan = await request(app)
      .post('/api/financial/loans')
      .set('Authorization', header)
      .send({ principal: 100 });
    expect(loan.status).toBe(201);
    expect(loan.body.loan.outstanding).toBe(100);

    const repay = await request(app)
      .post(`/api/financial/loans/${loan.body.loan.id}/repay`)
      .set('Authorization', header)
      .send({ amount: 100 });
    expect(repay.status).toBe(200);
    expect(repay.body.loan.status).toBe('repaid');
    expect(repay.body.credit_score).toBeGreaterThan(500);
    expect(repay.body.unlocked_badges.map((b: { code: string }) => b.code)).toContain('debt_free');
  });

  it('compounds loan interest into the outstanding balance', async () => {
    const id = seedTenant('Debt');
    const header = await authHeader(id);
    const loan = await request(app)
      .post('/api/financial/loans')
      .set('Authorization', header)
      .send({ principal: 100 });
    const loanId = loan.body.loan.id;

    const res = await request(app)
      .post(`/api/financial/loans/${loanId}/accrue`)
      .set('Authorization', header)
      .send({ period: '2024-W02' });
    expect(res.status).toBe(200);
    expect(res.body.outstanding).toBeGreaterThan(100);
  });
});
