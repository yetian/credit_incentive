export type Role = 'PARENT' | 'CHILD';
export type GameRole = 'employee' | 'contractor' | 'ceo';

export interface Tenant {
  id: number;
  name: string;
  role: Role;
  game_role: GameRole;
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
  kind: 'habit' | 'bounty';
  base_credit: number;
  active: number;
  created_at: string;
}

export interface Checkin {
  id: number;
  task_id: number;
  credit_awarded: number;
  multiplier_applied: number;
  streak: number;
  checked_on: string | null;
  created_at: string;
}

export interface TenantBadge {
  id: number;
  badge_id: number;
  awarded_at: string;
  code?: string;
  name?: string;
  emoji?: string;
}

export interface Badge {
  id: number;
  code: string;
  name: string;
  description: string | null;
  emoji: string;
}

export interface Streak {
  task_id: number;
  title: string;
  current_streak: number;
  best_streak: number;
  last_checked_on: string | null;
}

export interface Proposal {
  id: number;
  tenant_id: number;
  title: string;
  description: string | null;
  budget_requested: number;
  expected_return: number;
  status: 'pending' | 'approved' | 'rejected';
  review_note: string | null;
  actual_return: number | null;
  settled_at: string | null;
  created_at: string;
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

export interface Loan {
  id: number;
  principal: number;
  annual_rate: number;
  outstanding: number;
  status: 'active' | 'repaid' | 'defaulted';
  due_date: string | null;
  periods_accrued: number;
  created_at: string;
}

export interface Transaction {
  id: number;
  type: string;
  amount: number;
  balance_after: number | null;
  note: string | null;
  created_at: string;
}

export interface RoleProgress {
  role: GameRole;
  next: GameRole | null;
  requirements: { label: string; met: boolean; current: number; need: number }[];
}

export interface Profile {
  tenant: Tenant;
  account: Account;
  credit_score: number;
  loan_limit: number;
  income_multiplier: number;
  role_progress: RoleProgress;
  badges: TenantBadge[];
  streaks: Streak[];
  stats: { total_checkins: number; total_earned: number };
  active_loans: Loan[];
  recent_transactions: Transaction[];
}

export interface PromotionResult {
  promoted: boolean;
  from: GameRole;
  to: GameRole;
  bonus: number;
}

export interface AdminTask {
  id: number;
  tenant_id: number | null;
  title: string;
  description: string | null;
  kind: 'habit' | 'bounty';
  base_credit: number;
  active: number;
}

export interface ChildDashboard {
  tenant: Tenant;
  account: Account;
  credit_score: number;
  loan_limit: number;
  income_multiplier: number;
  role_progress: RoleProgress;
  stats: { total: number; earned: number; revoked: number };
  recent_checkins: (Checkin & { is_revoked: number; checked_on: string | null })[];
  pending_proposals: Proposal[];
  active_loans: Loan[];
  recent_transactions: Transaction[];
}

export interface CheckinResult {
  credit_awarded: number;
  streak_bonus: number;
  multiplier_applied: number;
  streak: number;
  liquid_balance: number;
  unlocked_badges: TenantBadge[];
  promotion: PromotionResult;
}

const TOKEN_KEY = 'ci_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.auth !== false) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = data?.error ?? `HTTP ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

export const api = {
  listTenants: () => request<{ tenants: Tenant[] }>('/auth/tenants', { auth: false }),
  issueToken: (tenant_id: number, pin_code?: string) =>
    request<{ token: string; tenant: Tenant }>('/auth/token', {
      method: 'POST',
      body: { tenant_id, pin_code },
      auth: false,
    }),
  parentVerify: (pin_code: string, tenant_id?: number) =>
    request<{ token: string; tenant: Tenant }>('/auth/parent-verify', {
      method: 'POST',
      body: { pin_code, tenant_id },
      auth: false,
    }),

  profile: () => request<Profile>('/gamification/profile'),
  allBadges: () => request<{ badges: Badge[] }>('/gamification/badges'),

  tasks: () => request<{ tasks: Task[] }>('/tasks'),
  streaks: () => request<{ streaks: Streak[] }>('/tasks/streaks'),
  createTask: (body: { title: string; description?: string; kind?: string; base_credit: number }) =>
    request<{ task: Task }>('/tasks', { method: 'POST', body }),
  checkin: (taskId: number, proof?: string) =>
    request<CheckinResult>(`/tasks/${taskId}/checkin`, { method: 'POST', body: { proof } }),
  deleteTask: (taskId: number) => request<null>(`/tasks/${taskId}`, { method: 'DELETE' }),

  proposals: (mine = false) => request<{ proposals: Proposal[] }>(`/proposals?mine=${mine}`),
  createProposal: (body: {
    title: string;
    description?: string;
    budget_requested: number;
    expected_return?: number;
  }) => request<{ proposal: Proposal }>('/proposals', { method: 'POST', body }),
  reviewProposal: (id: number, decision: 'approved' | 'rejected', note?: string) =>
    request<{ proposal: Proposal; unlocked_badges: TenantBadge[]; promotion: PromotionResult }>(
      `/proposals/${id}/review`,
      { method: 'POST', body: { decision, note } },
    ),
  settleProposal: (id: number, actual_return: number) =>
    request<{ proposal: Proposal; actual_return: number }>(`/proposals/${id}/settle`, {
      method: 'POST',
      body: { actual_return },
    }),

  assets: (forSale?: boolean) =>
    request<{ assets: Asset[]; income_multiplier: number }>(
      `/assets${forSale === undefined ? '' : `?for_sale=${forSale}`}`,
    ),
  myAssets: () => request<{ assets: Asset[]; income_multiplier: number }>('/assets?mine=true'),
  createAsset: (body: {
    name: string;
    description?: string;
    price: number;
    income_multiplier?: number;
  }) => request<{ asset: Asset }>('/assets', { method: 'POST', body }),
  updateAsset: (
    id: number,
    body: { name?: string; description?: string | null; price?: number; income_multiplier?: number; for_sale?: boolean },
  ) => request<{ asset: Asset }>(`/assets/${id}`, { method: 'PATCH', body }),
  purchaseAsset: (id: number) =>
    request<{ asset: Asset; balance: number; income_multiplier: number; unlocked_badges: TenantBadge[] }>(
      `/assets/${id}/purchase`,
      { method: 'POST' },
    ),
  sellAsset: (id: number, price?: number) =>
    request<{ asset: Asset }>(`/assets/${id}/sell`, { method: 'POST', body: { price } }),

  account: () => request<{ account: Account; credit_score: number; loan_limit: number }>('/financial/account'),
  transactions: () => request<{ transactions: Transaction[] }>('/financial/transactions'),
  deposit: (amount: number) =>
    request<{ account: Account }>('/financial/savings/deposit', { method: 'POST', body: { amount } }),
  withdraw: (amount: number) =>
    request<{ account: Account }>('/financial/savings/withdraw', { method: 'POST', body: { amount } }),
  accrueSavings: () =>
    request<{ interest: number; savings_balance: number }>('/financial/savings/accrue', {
      method: 'POST',
      body: {},
    }),
  loans: () => request<{ loans: Loan[] }>('/financial/loans'),
  requestLoan: (principal: number, due_date?: string) =>
    request<{ loan: Loan; balance: number; credit_score: number; limit: number }>('/financial/loans', {
      method: 'POST',
      body: { principal, due_date },
    }),
  repayLoan: (id: number, amount: number) =>
    request<{ loan: Loan; paid: number; credit_score: number; unlocked_badges: TenantBadge[] }>(
      `/financial/loans/${id}/repay`,
      { method: 'POST', body: { amount } },
    ),
  accrueLoan: (id: number) =>
    request<{ interest: number; outstanding: number }>(`/financial/loans/${id}/accrue`, {
      method: 'POST',
      body: {},
    }),

  members: () => request<{ tenants: Tenant[] }>('/members'),
  createMember: (name: string, role?: Role) =>
    request<{ tenant: Tenant }>('/members', { method: 'POST', body: { name, role } }),
  updateRole: (id: number, role: Role) =>
    request<{ tenant: Tenant }>(`/members/${id}/role`, { method: 'PATCH', body: { role } }),
  updateMember: (
    id: number,
    body: { role?: Role; game_role?: GameRole; pin_code?: string | null },
  ) => request<{ tenant: Tenant }>(`/members/${id}/role`, { method: 'PATCH', body }),
  allAssets: () => request<{ assets: Asset[]; income_multiplier: number }>('/assets'),

  // ---- Admin (PARENT only) ----
  adminChildren: () => request<{ children: ChildDashboard[] }>('/admin/children'),
  adminTasks: () => request<{ tasks: AdminTask[] }>('/admin/tasks'),
  adminCreateTask: (body: {
    title: string;
    description?: string;
    kind?: string;
    base_credit: number;
    child_id?: number | null;
  }) => request<{ task: AdminTask }>('/admin/tasks', { method: 'POST', body }),
  adminSetTaskActive: (id: number, active: boolean) =>
    request<{ task: AdminTask }>(`/admin/tasks/${id}`, { method: 'PATCH', body: { active } }),
  revokeCheckin: (id: number) =>
    request<{ checkin: Checkin; reversed_amount: number; liquid_balance: number }>(
      `/admin/check-in/${id}/revoke`,
      { method: 'POST' },
    ),
  adjustChild: (
    id: number,
    body: { liquid_delta?: number; savings_delta?: number; credit_score?: number; note?: string },
  ) =>
    request<{ tenant: Tenant; account: Account; applied: string[] }>(`/admin/children/${id}/adjust`, {
      method: 'POST',
      body,
    }),
};
