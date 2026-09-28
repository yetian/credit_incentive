import type { Request, Response } from 'express';
import * as assetService from '../services/assetService';
import { evaluateBadges } from '../services/badgeService';
import { evaluateRole } from '../services/roleService';
import { HttpError } from '../utils/http';

export function listAssets(req: Request, res: Response): void {
  const forSale = req.query.for_sale === undefined ? undefined : req.query.for_sale === 'true';
  const ownerId = req.query.mine === 'true' ? req.tenantId : undefined;
  const assets = assetService.listAssets({ forSale, ownerId });
  res.json({ assets, income_multiplier: assetService.getIncomeMultiplier(req.tenantId!) });
}

export function createAsset(req: Request, res: Response): void {
  const asset = assetService.createAsset({
    name: req.body?.name,
    description: req.body?.description ?? null,
    price: req.body?.price,
    income_multiplier: req.body?.income_multiplier,
    for_sale: req.body?.for_sale,
  });
  res.status(201).json({ asset });
}

export function updateAsset(req: Request, res: Response): void {
  const assetId = Number(req.params.id);
  if (!Number.isInteger(assetId)) throw new HttpError(400, 'invalid asset id');
  const asset = assetService.updateAsset(assetId, req.body ?? {});
  res.json({ asset });
}

export function purchaseAsset(req: Request, res: Response): void {
  const assetId = Number(req.params.id);
  if (!Number.isInteger(assetId)) throw new HttpError(400, 'invalid asset id');
  const result = assetService.purchaseAsset(req.tenantId!, assetId);
  const unlocked = evaluateBadges(req.tenantId!);
  const promotion = evaluateRole(req.tenantId!);
  res.json({ ...result, unlocked_badges: unlocked, promotion });
}

export function listAssetForSale(req: Request, res: Response): void {
  const assetId = Number(req.params.id);
  if (!Number.isInteger(assetId)) throw new HttpError(400, 'invalid asset id');
  const asset = assetService.listAssetForSale(
    req.tenantId!,
    assetId,
    req.body?.price,
    req.tenantRole === 'PARENT',
  );
  res.json({ asset });
}
