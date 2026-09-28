import { Router } from 'express';
import * as assetController from '../controllers/assetController';
import { requireAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createAssetSchema, priceSchema, updateAssetSchema } from '../schemas';

export const assetRouter = Router();

assetRouter.get('/', assetController.listAssets);

// Children may redeem / buy from the store.
assetRouter.post('/:id/purchase', assetController.purchaseAsset);

// Only parents manage the store catalogue (tools & rewards).
assetRouter.post('/', requireAdmin, validate(createAssetSchema), assetController.createAsset);
assetRouter.patch('/:id', requireAdmin, validate(updateAssetSchema), assetController.updateAsset);
assetRouter.post('/:id/sell', requireAdmin, validate(priceSchema), assetController.listAssetForSale);
