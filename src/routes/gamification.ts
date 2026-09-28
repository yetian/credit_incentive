import { Router } from 'express';
import * as gamificationController from '../controllers/gamificationController';

export const gamificationRouter = Router();

gamificationRouter.get('/profile', gamificationController.getProfile);
gamificationRouter.get('/badges', gamificationController.listAllBadges);
gamificationRouter.get('/badges/mine', gamificationController.listMyBadges);
gamificationRouter.get('/progress', gamificationController.getProgress);
