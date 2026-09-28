import { Router } from 'express';
import * as proposalController from '../controllers/proposalController';
import { validate } from '../middleware/validate';
import { createProposalSchema, reviewProposalSchema, settleProposalSchema } from '../schemas';

export const proposalRouter = Router();

proposalRouter.get('/', proposalController.listProposals);
proposalRouter.post('/', validate(createProposalSchema), proposalController.createProposal);
proposalRouter.post(
  '/:id/review',
  validate(reviewProposalSchema),
  proposalController.reviewProposal,
);
proposalRouter.post('/:id/settle', validate(settleProposalSchema), proposalController.settleProposal);
