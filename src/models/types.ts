/** Permission axis: PARENT is the global admin, CHILD is a standard user. */
export type TenantRole = 'PARENT' | 'CHILD';

/** Progression axis for children: employee -> contractor -> ceo. */
export type GameRole = 'employee' | 'contractor' | 'ceo';

export type TaskKind = 'habit' | 'bounty';

export type CheckinStatus = 'pending' | 'approved' | 'rejected';

export type ProposalStatus = 'pending' | 'approved' | 'rejected';

export type LoanStatus = 'active' | 'repaid' | 'defaulted';

export type TransactionType =
  | 'checkin_reward'
  | 'bounty_reward'
  | 'streak_bonus'
  | 'badge_reward'
  | 'promotion_bonus'
  | 'revoke_adjustment'
  | 'admin_adjustment'
  | 'proposal_budget'
  | 'proposal_return'
  | 'asset_purchase'
  | 'asset_sale'
  | 'savings_deposit'
  | 'savings_withdraw'
  | 'interest'
  | 'loan_disbursement'
  | 'loan_repayment'
  | 'loan_interest'
  | 'adjustment';

export type RefTable =
  | 'checkins'
  | 'proposals'
  | 'assets'
  | 'loans'
  | 'loan_repayments'
  | 'savings_accruals'
  | 'loan_accruals'
  | 'badges'
  | 'tenants';

export interface Tenant {
  id: number;
  name: string;
  role: TenantRole;
  game_role: GameRole;
  pin_code: string | null;
  credit_score: number;
  created_at: string;
}

export interface Account {
  tenant_id: number;
  liquid_balance: number;
  savings_balance: number;
  updated_at: string;
}

export interface Task {
  id: number;
  tenant_id: number | null;
  title: string;
  description: string | null;
  kind: TaskKind;
  base_credit: number;
  active: number;
  created_at: string;
}

export interface Checkin {
  id: number;
  tenant_id: number;
  task_id: number;
  proof: string | null;
  credit_awarded: number;
  multiplier_applied: number;
  status: CheckinStatus;
  note: string | null;
  checked_on: string | null;
  streak: number;
  is_revoked: number;
  revoked_at: string | null;
  revoked_by: number | null;
  created_at: string;
}

export interface Proposal {
  id: number;
  tenant_id: number;
  title: string;
  description: string | null;
  budget_requested: number;
  expected_return: number;
  status: ProposalStatus;
  reviewed_by: number | null;
  review_note: string | null;
  actual_return: number | null;
  settled_at: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface Asset {
  id: number;
  name: string;
  description: string | null;
  price: number;
  income_multiplier: number;
  owner_tenant_id: number | null;
  for_sale: number;
  created_at: string;
}

export interface Transaction {
  id: number;
  tenant_id: number;
  type: TransactionType;
  amount: number;
  balance_after: number | null;
  ref_table: RefTable | null;
  ref_id: number | null;
  note: string | null;
  created_at: string;
}

export interface Loan {
  id: number;
  tenant_id: number;
  principal: number;
  annual_rate: number;
  outstanding: number;
  status: LoanStatus;
  due_date: string | null;
  periods_accrued: number;
  last_accrual_at: string | null;
  created_at: string;
}

export interface LoanAccrual {
  id: number;
  loan_id: number;
  tenant_id: number;
  period: string;
  principal: number;
  rate: number;
  interest: number;
  created_at: string;
}

export interface Badge {
  id: number;
  code: string;
  name: string;
  description: string | null;
  emoji: string;
  created_at: string;
}

export interface TenantBadge {
  id: number;
  tenant_id: number;
  badge_id: number;
  awarded_at: string;
  code?: string;
  name?: string;
  emoji?: string;
}

export interface LoanRepayment {
  id: number;
  loan_id: number;
  tenant_id: number;
  amount: number;
  created_at: string;
}

export interface SavingsAccrual {
  id: number;
  tenant_id: number;
  period: string;
  principal: number;
  rate: number;
  interest: number;
  created_at: string;
}

export interface JwtPayload {
  tenant_id: number;
  role: TenantRole;
  game_role: GameRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenantId?: number;
      tenantRole?: TenantRole;
      tenantGameRole?: GameRole;
    }
  }
}
