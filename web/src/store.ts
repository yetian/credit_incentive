import { reactive } from 'vue';
import { api, getToken, setToken, type Profile, type Tenant } from './api';

interface State {
  token: string | null;
  profile: Profile | null;
  tenants: Tenant[];
  loading: boolean;
  toast: string;
  error: string;
}

export const store = reactive<State>({
  token: getToken(),
  profile: null,
  tenants: [],
  loading: false,
  toast: '',
  error: '',
});

export function notify(message: string): void {
  store.toast = message;
  window.setTimeout(() => {
    if (store.toast === message) store.toast = '';
  }, 3500);
}

export function fail(message: string): void {
  store.error = message;
  window.setTimeout(() => {
    if (store.error === message) store.error = '';
  }, 4000);
}

export async function loadTenants(): Promise<void> {
  store.tenants = (await api.listTenants()).tenants;
}

export async function loadProfile(): Promise<void> {
  store.profile = await api.profile();
}

export async function bootstrap(): Promise<void> {
  await loadTenants();
  if (store.token) {
    try {
      await loadProfile();
    } catch {
      logout();
    }
  }
}

export async function login(tenantId: number, pin?: string): Promise<void> {
  const result = await api.issueToken(tenantId, pin);
  setToken(result.token);
  store.token = result.token;
  await loadProfile();
}

/** Upgrade the current session to a PARENT (admin) token using a PIN. */
export async function upgradeToParent(pin: string): Promise<void> {
  const result = await api.parentVerify(pin);
  setToken(result.token);
  store.token = result.token;
  await loadProfile();
}

/** Change the current tenant's own PIN (parents only in practice). */
export async function changeOwnPin(pin: string): Promise<void> {
  if (!store.profile) throw new Error('未登录');
  await api.updateMember(store.profile.tenant.id, { pin_code: pin });
  await loadProfile();
}

export function logout(): void {
  setToken(null);
  store.token = null;
  store.profile = null;
}

export async function refresh(): Promise<void> {
  await Promise.all([loadProfile(), loadTenants()]);
}

export function isAdmin(): boolean {
  return store.profile?.tenant.role === 'PARENT';
}

export function roleEmoji(role: string, gameRole?: string): string {
  if (role === 'PARENT') return '👑';
  if (gameRole === 'ceo') return '🎖️';
  if (gameRole === 'contractor') return '🛠️';
  return '🧒';
}
