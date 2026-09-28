import { config } from '../config';
import { db } from '../db';
import { adjustLiquid, getAccount, recordTransaction } from './accountService';
import { HttpError, round2 } from '../utils/http';
import type { Asset } from '../models/types';

export interface AssetInput {
  name: string;
  description?: string | null;
  price: number;
  income_multiplier?: number;
  for_sale?: boolean;
}

export function getIncomeMultiplier(tenantId: number): number {
  const rows = db
    .prepare(
      'SELECT income_multiplier FROM assets WHERE owner_tenant_id = ? AND income_multiplier > 0',
    )
    .all(tenantId) as { income_multiplier: number }[];

  const product = rows.reduce((acc, row) => acc * row.income_multiplier, 1);
  return Math.min(round2(product), config.asset.multiplierCap);
}

export function listAssets(filter: { forSale?: boolean; ownerId?: number } = {}): Asset[] {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filter.forSale !== undefined) {
    clauses.push('for_sale = ?');
    params.push(filter.forSale ? 1 : 0);
  }
  if (filter.ownerId !== undefined) {
    clauses.push('owner_tenant_id = ?');
    params.push(filter.ownerId);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db
    .prepare(`SELECT * FROM assets ${where} ORDER BY price ASC`)
    .all(...params) as Asset[];
}

export function getAsset(assetId: number): Asset {
  const asset = db
    .prepare('SELECT * FROM assets WHERE id = ?')
    .get(assetId) as Asset | undefined;
  if (!asset) throw new HttpError(404, 'Asset not found');
  return asset;
}

export function createAsset(input: AssetInput): Asset {
  const name = (input.name ?? '').trim();
  if (!name) throw new HttpError(400, 'name is required');

  const price = Number(input.price);
  if (!Number.isFinite(price) || price < 0) {
    throw new HttpError(400, 'price must be a non-negative number');
  }

  const multiplier = input.income_multiplier ?? 1;
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new HttpError(400, 'income_multiplier must be > 0');
  }

  const info = db
    .prepare(
      `INSERT INTO assets (name, description, price, income_multiplier, for_sale)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      name,
      input.description ?? null,
      round2(price),
      round2(multiplier),
      input.for_sale === false ? 0 : 1,
    );

  return getAsset(Number(info.lastInsertRowid));
}

export function purchaseAsset(tenantId: number, assetId: number) {
  return db.transaction(() => {
    const asset = getAsset(assetId);

    if (!asset.for_sale) throw new HttpError(400, 'Asset is not for sale');
    if (asset.owner_tenant_id === tenantId) {
      throw new HttpError(400, 'You already own this asset');
    }

    const account = getAccount(tenantId);
    if (account.liquid_balance < asset.price) {
      throw new HttpError(400, 'Insufficient liquid credit', {
        required: asset.price,
        available: account.liquid_balance,
      });
    }

    const sellerId = asset.owner_tenant_id;

    adjustLiquid(tenantId, -asset.price);
    recordTransaction(tenantId, 'asset_purchase', -asset.price, {
      refTable: 'assets',
      refId: assetId,
      note: sellerId ? `${asset.name} (来自成员 #${sellerId})` : asset.name,
    });

    // If a member owned it, transfer the proceeds to the seller.
    if (sellerId !== null) {
      adjustLiquid(sellerId, asset.price);
      recordTransaction(sellerId, 'asset_sale', asset.price, {
        refTable: 'assets',
        refId: assetId,
        note: `出售给成员 #${tenantId}: ${asset.name}`,
      });
    }

    db.prepare(
      'UPDATE assets SET owner_tenant_id = ?, for_sale = 0 WHERE id = ?',
    ).run(tenantId, assetId);

    return {
      asset: getAsset(assetId),
      balance: getAccount(tenantId).liquid_balance,
      income_multiplier: getIncomeMultiplier(tenantId),
      seller_id: sellerId,
    };
  })();
}

export function listAssetForSale(
  tenantId: number,
  assetId: number,
  price?: number,
  asAdmin = false,
): Asset {
  const asset = getAsset(assetId);
  if (!asAdmin && asset.owner_tenant_id !== tenantId) {
    throw new HttpError(403, 'You do not own this asset');
  }
  const nextPrice = price === undefined ? asset.price : round2(Number(price));
  if (!Number.isFinite(nextPrice) || nextPrice < 0) {
    throw new HttpError(400, 'price must be a non-negative number');
  }
  db.prepare(
    'UPDATE assets SET for_sale = 1, price = ? WHERE id = ?',
  ).run(nextPrice, assetId);
  return getAsset(assetId);
}

export interface AssetUpdate {
  name?: string;
  description?: string | null;
  price?: number;
  income_multiplier?: number;
  for_sale?: boolean;
}

export function updateAsset(assetId: number, input: AssetUpdate): Asset {
  getAsset(assetId);

  const fields: string[] = [];
  const params: unknown[] = [];

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new HttpError(400, 'name cannot be empty');
    fields.push('name = ?');
    params.push(name);
  }
  if (input.description !== undefined) {
    fields.push('description = ?');
    params.push(input.description);
  }
  if (input.price !== undefined) {
    const price = Number(input.price);
    if (!Number.isFinite(price) || price < 0) throw new HttpError(400, 'price must be >= 0');
    fields.push('price = ?');
    params.push(round2(price));
  }
  if (input.income_multiplier !== undefined) {
    const m = Number(input.income_multiplier);
    if (!Number.isFinite(m) || m <= 0) throw new HttpError(400, 'income_multiplier must be > 0');
    fields.push('income_multiplier = ?');
    params.push(round2(m));
  }
  if (input.for_sale !== undefined) {
    fields.push('for_sale = ?');
    params.push(input.for_sale ? 1 : 0);
  }

  if (!fields.length) throw new HttpError(400, 'Nothing to update');

  params.push(assetId);
  db.prepare(`UPDATE assets SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  return getAsset(assetId);
}
