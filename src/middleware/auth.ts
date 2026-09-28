import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db } from '../db';
import { HttpError } from '../utils/http';
import type { GameRole, JwtPayload, TenantRole } from '../models/types';

interface LoadedTenant {
  id: number;
  role: TenantRole;
  game_role: GameRole;
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new HttpError(401, 'Missing Authorization: Bearer <JWT> header');
  }

  const token = header.slice('Bearer '.length).trim();
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }

  // Load fresh from the DB so role/permission changes take effect immediately.
  const tenant = db
    .prepare('SELECT id, role, game_role FROM tenants WHERE id = ?')
    .get(payload.tenant_id) as LoadedTenant | undefined;

  if (!tenant) {
    throw new HttpError(401, 'Tenant no longer exists');
  }

  req.tenantId = tenant.id;
  req.tenantRole = tenant.role;
  req.tenantGameRole = tenant.game_role;
  next();
}

/** Only the global admin (PARENT) may pass. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.tenantRole !== 'PARENT') {
    throw new HttpError(403, 'PARENT (admin) permission required');
  }
  next();
}

/** Require one of the given in-game progression roles. */
export function requireRole(...roles: GameRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.tenantGameRole || !roles.includes(req.tenantGameRole)) {
      throw new HttpError(403, `Requires game role: ${roles.join(' or ')}`);
    }
    next();
  };
}
