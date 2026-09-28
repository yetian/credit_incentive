import { z } from 'zod';

const permRole = z.enum(['PARENT', 'CHILD']);
const gameRole = z.enum(['employee', 'contractor', 'ceo']);

export const issueTokenSchema = z
  .object({
    tenant_id: z.number().int().positive().optional(),
    tenantId: z.number().int().positive().optional(),
    pin_code: z.string().min(1).max(12).optional(),
  })
  .refine((v) => v.tenant_id !== undefined || v.tenantId !== undefined, {
    message: 'tenant_id is required',
  });

export const parentVerifySchema = z.object({
  pin_code: z.string().min(1).max(12),
  tenant_id: z.number().int().positive().optional(),
});

export const createMemberSchema = z.object({
  name: z.string().min(1).max(60),
  role: permRole.optional(),
  game_role: gameRole.optional(),
  pin_code: z.string().min(1).max(12).nullable().optional(),
  credit_score: z.number().int().min(0).max(1000).optional(),
});

export const updateRoleSchema = z
  .object({
    role: permRole.optional(),
    game_role: gameRole.optional(),
    pin_code: z.string().min(1).max(12).nullable().optional(),
  })
  .refine((v) => v.role !== undefined || v.game_role !== undefined || v.pin_code !== undefined, {
    message: 'Provide role, game_role or pin_code',
  });

export const createTaskSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  kind: z.enum(['habit', 'bounty']).optional(),
  base_credit: z.number().positive(),
});

export const createAdminTaskSchema = createTaskSchema.extend({
  child_id: z.number().int().positive().nullable().optional(),
});

export const setTaskActiveSchema = z.object({ active: z.boolean() });

export const adjustChildSchema = z
  .object({
    liquid_delta: z.number().optional(),
    savings_delta: z.number().optional(),
    credit_score: z.number().min(0).max(1000).optional(),
    note: z.string().max(200).optional(),
  })
  .refine(
    (v) =>
      v.liquid_delta !== undefined || v.savings_delta !== undefined || v.credit_score !== undefined,
    { message: 'Provide at least one adjustment' },
  );

export const checkinSchema = z.object({
  task_id: z.number().int().positive().optional(),
  proof: z.string().max(1000).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

export const createProposalSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  budget_requested: z.number().min(0),
  expected_return: z.number().min(0).optional(),
});

export const reviewProposalSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  note: z.string().max(500).optional(),
});

export const settleProposalSchema = z.object({
  actual_return: z.number(),
  note: z.string().max(500).optional(),
});

export const createAssetSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  price: z.number().min(0),
  income_multiplier: z.number().positive().optional(),
  for_sale: z.boolean().optional(),
});

export const updateAssetSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(500).nullable().optional(),
    price: z.number().min(0).optional(),
    income_multiplier: z.number().positive().optional(),
    for_sale: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const priceSchema = z.object({
  price: z.number().min(0).optional(),
});

export const amountSchema = z.object({
  amount: z.number().positive(),
});

export const periodSchema = z.object({
  period: z.string().min(1).max(20).optional(),
});

export const requestLoanSchema = z.object({
  principal: z.number().positive(),
  due_date: z.string().min(1).max(30).nullable().optional(),
});

export const repayLoanSchema = z.object({
  amount: z.number().positive(),
});
