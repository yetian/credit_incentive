import { db } from '../db';
import type { Account, RefTable, Transaction, TransactionType } from '../models/types';
import { round2 } from '../utils/http';

export function ensureAccount(tenantId: number): Account {
  const existing = db
    .prepare('SELECT * FROM accounts WHERE tenant_id = ?')
    .get(tenantId) as Account | undefined;
  if (existing) return existing;

  db.prepare('INSERT OR IGNORE INTO accounts (tenant_id) VALUES (?)').run(tenantId);
  return db
    .prepare('SELECT * FROM accounts WHERE tenant_id = ?')
    .get(tenantId) as Account;
}

export function getAccount(tenantId: number): Account {
  return ensureAccount(tenantId);
}

export function adjustLiquid(tenantId: number, delta: number): Account {
  ensureAccount(tenantId);
  db.prepare(
    `UPDATE accounts
       SET liquid_balance = ROUND(liquid_balance + ?, 2),
           updated_at = datetime('now')
     WHERE tenant_id = ?`,
  ).run(round2(delta), tenantId);
  return getAccount(tenantId);
}

export function adjustSavings(tenantId: number, delta: number): Account {
  ensureAccount(tenantId);
  db.prepare(
    `UPDATE accounts
       SET savings_balance = ROUND(savings_balance + ?, 2),
           updated_at = datetime('now')
     WHERE tenant_id = ?`,
  ).run(round2(delta), tenantId);
  return getAccount(tenantId);
}

export interface RecordOptions {
  refTable?: RefTable;
  refId?: number;
  note?: string;
}

export function recordTransaction(
  tenantId: number,
  type: TransactionType,
  amount: number,
  options: RecordOptions = {},
): Transaction {
  const account = ensureAccount(tenantId);
  const info = db
    .prepare(
      `INSERT INTO transactions (tenant_id, type, amount, balance_after, ref_table, ref_id, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      tenantId,
      type,
      round2(amount),
      account.liquid_balance,
      options.refTable ?? null,
      options.refId ?? null,
      options.note ?? null,
    );

  return db
    .prepare('SELECT * FROM transactions WHERE id = ?')
    .get(info.lastInsertRowid) as Transaction;
}

export function listTransactions(tenantId: number, limit = 50): Transaction[] {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 500);
  return db
    .prepare(
      'SELECT * FROM transactions WHERE tenant_id = ? ORDER BY id DESC LIMIT ?',
    )
    .all(tenantId, safeLimit) as Transaction[];
}
