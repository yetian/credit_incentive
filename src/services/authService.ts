import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db } from '../db';
import { ensureAccount } from './accountService';
import { HttpError } from '../utils/http';
import type { GameRole, Tenant, TenantRole } from '../models/types';

const ROLES: TenantRole[] = ['PARENT', 'CHILD'];
const GAME_ROLES: GameRole[] = ['employee', 'contractor', 'ceo'];

export function signTenantToken(tenant: Pick<Tenant, 'id' | 'role' | 'game_role'>): string {
  const payload = { tenant_id: tenant.id, role: tenant.role, game_role: tenant.game_role };
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
}

export function listTenants(): Tenant[] {
  return db.prepare('SELECT * FROM tenants ORDER BY id ASC').all() as Tenant[];
}

export function getTenant(tenantId: number): Tenant {
  const tenant = db
    .prepare('SELECT * FROM tenants WHERE id = ?')
    .get(tenantId) as Tenant | undefined;
  if (!tenant) throw new HttpError(404, 'Tenant not found');
  return tenant;
}

export interface CreateTenantInput {
  name: string;
  role?: TenantRole;
  game_role?: GameRole;
  pin_code?: string | null;
  credit_score?: number;
}

export function createTenant(input: CreateTenantInput): Tenant {
  const name = (input.name ?? '').trim();
  if (!name) throw new HttpError(400, 'name is required');

  const role: TenantRole = input.role ?? 'CHILD';
  if (!ROLES.includes(role)) {
    throw new HttpError(400, `role must be one of: ${ROLES.join(', ')}`);
  }

  const gameRole: GameRole = input.game_role ?? (role === 'PARENT' ? 'ceo' : 'employee');
  if (!GAME_ROLES.includes(gameRole)) {
    throw new HttpError(400, `game_role must be one of: ${GAME_ROLES.join(', ')}`);
  }

  const score = Number.isFinite(input.credit_score) ? Number(input.credit_score) : 500;
  const pin = input.pin_code ?? (role === 'PARENT' ? config.parent.defaultPin : null);

  const info = db
    .prepare(
      'INSERT INTO tenants (name, role, game_role, pin_code, credit_score) VALUES (?, ?, ?, ?, ?)',
    )
    .run(name, role, gameRole, pin, score);

  const tenant = getTenant(Number(info.lastInsertRowid));
  ensureAccount(tenant.id);
  return tenant;
}

export function updateRole(tenantId: number, role: TenantRole): Tenant {
  if (!ROLES.includes(role)) {
    throw new HttpError(400, `role must be one of: ${ROLES.join(', ')}`);
  }
  getTenant(tenantId);
  db.prepare('UPDATE tenants SET role = ?, pin_code = COALESCE(pin_code, ?) WHERE id = ?').run(
    role,
    role === 'PARENT' ? config.parent.defaultPin : null,
    tenantId,
  );
  return getTenant(tenantId);
}

export function updateGameRole(tenantId: number, gameRole: GameRole): Tenant {
  if (!GAME_ROLES.includes(gameRole)) {
    throw new HttpError(400, `game_role must be one of: ${GAME_ROLES.join(', ')}`);
  }
  getTenant(tenantId);
  db.prepare('UPDATE tenants SET game_role = ? WHERE id = ?').run(gameRole, tenantId);
  return getTenant(tenantId);
}

export function setPin(tenantId: number, pin: string | null): Tenant {
  getTenant(tenantId);
  db.prepare('UPDATE tenants SET pin_code = ? WHERE id = ?').run(pin, tenantId);
  return getTenant(tenantId);
}

/**
 * Verify a parent by PIN. When tenant_id is given, that specific parent must
 * match; otherwise the first parent matching the PIN is returned.
 */
export function verifyParentPin(pin: string, tenantId?: number): Tenant {
  const clean = (pin ?? '').trim();
  if (!clean) throw new HttpError(400, 'pin_code is required');

  let parent: Tenant | undefined;
  if (tenantId !== undefined) {
    const candidate = getTenant(tenantId);
    parent = candidate.role === 'PARENT' && candidate.pin_code === clean ? candidate : undefined;
  } else {
    parent = db
      .prepare("SELECT * FROM tenants WHERE role = 'PARENT' AND pin_code = ? ORDER BY id ASC LIMIT 1")
      .get(clean) as Tenant | undefined;
  }

  if (!parent) throw new HttpError(401, 'Invalid PIN');
  return parent;
}

export function childCount(): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM tenants WHERE role = 'CHILD'").get() as {
    n: number;
  }).n;
}
