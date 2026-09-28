import request from 'supertest';
import { createApp } from '../src/app';
import { createTenant, type CreateTenantInput } from '../src/services/authService';
import type { Express } from 'express';

export const app: Express = createApp();
export const DEFAULT_PIN = '0000';

export function seedTenant(name: string, opts: Partial<CreateTenantInput> = {}): number {
  return createTenant({ name, ...opts }).id;
}

export async function authHeader(tenantId: number, pin?: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/token')
    .send({ tenant_id: tenantId, ...(pin ? { pin_code: pin } : {}) });
  if (res.status !== 200) throw new Error(`token failed: ${res.status} ${res.text}`);
  return `Bearer ${res.body.token}`;
}

/** Seed a PARENT and return its id + ready-to-use admin Authorization header. */
export async function adminActor(
  name = 'Admin',
): Promise<{ id: number; header: string }> {
  const id = seedTenant(name, { role: 'PARENT' });
  const header = await authHeader(id, DEFAULT_PIN);
  return { id, header };
}
