import type { Request, Response } from 'express';
import * as authService from '../services/authService';
import { HttpError } from '../utils/http';
import type { GameRole, TenantRole } from '../models/types';

function publicTenant(tenant: {
  id: number;
  name: string;
  role: TenantRole;
  game_role: GameRole;
  credit_score: number;
}) {
  return {
    id: tenant.id,
    name: tenant.name,
    role: tenant.role,
    game_role: tenant.game_role,
    credit_score: tenant.credit_score,
  };
}

export function listTenants(_req: Request, res: Response): void {
  // Never leak PIN codes through the public list.
  res.json({ tenants: authService.listTenants().map(publicTenant) });
}

export function issueToken(req: Request, res: Response): void {
  const tenantId = Number(req.body?.tenant_id ?? req.body?.tenantId);
  if (!Number.isInteger(tenantId)) {
    throw new HttpError(400, 'tenant_id is required');
  }

  const tenant = authService.getTenant(tenantId);

  // Parents are admin accounts: a PIN is mandatory before a token is issued.
  if (tenant.role === 'PARENT') {
    const pin = req.body?.pin_code;
    if (!tenant.pin_code || pin !== tenant.pin_code) {
      throw new HttpError(401, '家长账号需要正确的 PIN 码');
    }
  }

  const token = authService.signTenantToken(tenant);
  res.json({ token, token_type: 'Bearer', tenant: publicTenant(tenant) });
}

export function parentVerify(req: Request, res: Response): void {
  const pin = req.body?.pin_code;
  const tenantId = req.body?.tenant_id === undefined ? undefined : Number(req.body.tenant_id);
  const parent = authService.verifyParentPin(pin, tenantId);
  const token = authService.signTenantToken(parent);
  res.json({ token, token_type: 'Bearer', tenant: publicTenant(parent) });
}

export function me(req: Request, res: Response): void {
  const tenant = authService.getTenant(req.tenantId!);
  res.json({ tenant });
}

export function createMember(req: Request, res: Response): void {
  const tenant = authService.createTenant({
    name: req.body?.name,
    role: req.body?.role,
    game_role: req.body?.game_role,
    pin_code: req.body?.pin_code ?? undefined,
    credit_score: req.body?.credit_score,
  });
  res.status(201).json({ tenant });
}

export function updateRole(req: Request, res: Response): void {
  const tenantId = Number(req.params.id);
  if (!Number.isInteger(tenantId)) throw new HttpError(400, 'invalid tenant id');

  if (req.body?.game_role !== undefined) {
    authService.updateGameRole(tenantId, req.body.game_role as GameRole);
  }
  if (req.body?.role !== undefined) {
    authService.updateRole(tenantId, req.body.role as TenantRole);
  }
  if (req.body?.pin_code !== undefined) {
    authService.setPin(tenantId, req.body.pin_code);
  }

  res.json({ tenant: authService.getTenant(tenantId) });
}
