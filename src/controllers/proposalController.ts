import type { Request, Response } from 'express';
import * as proposalService from '../services/proposalService';
import { evaluateBadges } from '../services/badgeService';
import { evaluateRole } from '../services/roleService';
import { HttpError } from '../utils/http';
import type { ProposalStatus } from '../models/types';

export function listProposals(req: Request, res: Response): void {
  const mine = req.query.mine === 'true';
  const status = req.query.status as ProposalStatus | undefined;
  const proposals = proposalService.listProposals({
    tenantId: mine ? req.tenantId : undefined,
    status,
  });
  res.json({ proposals });
}

export function createProposal(req: Request, res: Response): void {
  const proposal = proposalService.createProposal(req.tenantId!, {
    title: req.body?.title,
    description: req.body?.description ?? null,
    budget_requested: req.body?.budget_requested,
    expected_return: req.body?.expected_return,
  });
  res.status(201).json({ proposal });
}

export function reviewProposal(req: Request, res: Response): void {
  const proposalId = Number(req.params.id);
  if (!Number.isInteger(proposalId)) throw new HttpError(400, 'invalid proposal id');

  const decision = req.body?.decision;
  if (decision !== 'approved' && decision !== 'rejected') {
    throw new HttpError(400, 'decision must be "approved" or "rejected"');
  }

  const result = proposalService.reviewProposal(
    { id: req.tenantId!, role: req.tenantRole!, gameRole: req.tenantGameRole! },
    proposalId,
    decision,
    req.body?.note,
  );

  const unlocked = decision === 'approved' ? evaluateBadges(result.proposal.tenant_id) : [];
  const promotion = decision === 'approved' ? evaluateRole(result.proposal.tenant_id) : null;
  res.json({ ...result, unlocked_badges: unlocked, promotion });
}

export function settleProposal(req: Request, res: Response): void {
  const proposalId = Number(req.params.id);
  if (!Number.isInteger(proposalId)) throw new HttpError(400, 'invalid proposal id');

  const result = proposalService.settleProposal(
    { id: req.tenantId!, role: req.tenantRole!, gameRole: req.tenantGameRole! },
    proposalId,
    req.body?.actual_return,
    req.body?.note,
  );
  const unlocked = evaluateBadges(result.proposal.tenant_id);
  const promotion = evaluateRole(result.proposal.tenant_id);
  res.json({ ...result, unlocked_badges: unlocked, promotion });
}
