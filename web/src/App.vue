<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  Gamepad2,
  Wallet,
  PiggyBank,
  Rocket,
  ShieldCheck,
  Home,
  CheckCircle2,
  Lightbulb,
  ShoppingBag,
  Landmark,
  ListChecks,
  Gift,
  ClipboardCheck,
  Users,
  Settings,
  Lock,
  RefreshCw,
  LogOut,
} from 'lucide-vue-next';
import { store, logout, roleEmoji, refresh, isAdmin, upgradeToParent, notify, fail } from './store';

const router = useRouter();
const profile = computed(() => store.profile);
const admin = computed(() => isAdmin());

const childNav = [
  { to: '/', label: '仪表盘', icon: Home },
  { to: '/tasks', label: '打卡', icon: CheckCircle2 },
  { to: '/proposals', label: '提案', icon: Lightbulb },
  { to: '/shop', label: '商店', icon: ShoppingBag },
  { to: '/finance', label: '沙盒银行', icon: Landmark },
];
const adminNav = [
  { to: '/admin', label: '孩子看板', icon: ShieldCheck },
  { to: '/admin/tasks', label: '任务', icon: ListChecks },
  { to: '/admin/rewards', label: '奖励/商店', icon: Gift },
  { to: '/admin/proposals', label: '提案审批', icon: ClipboardCheck },
  { to: '/admin/members', label: '成员', icon: Users },
  { to: '/admin/settings', label: '设置', icon: Settings },
];

const showPin = ref(false);
const pin = ref('');
const pinBusy = ref(false);

async function activateParent() {
  pinBusy.value = true;
  try {
    await upgradeToParent(pin.value);
    showPin.value = false;
    pin.value = '';
    notify('🛡️ 已进入家长模式');
    router.push('/admin');
  } catch (e) {
    fail((e as Error).message);
  } finally {
    pinBusy.value = false;
  }
}

function doLogout() {
  logout();
  router.push('/login');
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <template v-if="profile">
      <!-- Navbar -->
      <header class="bg-indigo-600 text-white shadow-md sticky top-0 z-40">
        <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div class="flex items-center gap-2">
            <Gamepad2 class="w-8 h-8" />
            <div>
              <h1 class="text-lg font-bold leading-tight">成长沙盒 Sandbox</h1>
              <p class="text-[11px] text-indigo-200 leading-none">
                {{ admin ? '家长管理后台' : '孩子的成长与决策' }}
              </p>
            </div>
          </div>

          <div class="hidden md:flex items-center gap-4 text-sm">
            <span class="flex items-center gap-1.5">
              <Wallet class="w-4 h-4 text-blue-200" />
              <b>{{ profile.account.liquid_balance.toFixed(2) }}</b>
            </span>
            <span class="flex items-center gap-1.5">
              <PiggyBank class="w-4 h-4 text-emerald-200" />
              <b>{{ profile.account.savings_balance.toFixed(2) }}</b>
            </span>
            <span class="flex items-center gap-1.5">
              <Rocket class="w-4 h-4 text-purple-200" />
              <b>{{ profile.income_multiplier }}x</b>
            </span>
          </div>

          <div class="flex items-center gap-2 bg-indigo-700 px-3 py-1.5 rounded-full border border-indigo-500">
            <span class="text-lg">{{ roleEmoji(profile.tenant.role, profile.tenant.game_role) }}</span>
            <span class="text-sm font-semibold">{{ profile.tenant.name }}</span>
            <span class="text-xs bg-indigo-500 rounded-full px-2 py-0.5">{{ profile.tenant.role }}</span>
          </div>

          <div class="flex items-center gap-2">
            <button
              v-if="!admin"
              class="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-xl"
              @click="showPin = true"
            >
              <Lock class="w-4 h-4" /> 家长
            </button>
            <button
              class="p-2 rounded-xl bg-indigo-700 hover:bg-indigo-800"
              title="刷新"
              @click="refresh"
            >
              <RefreshCw class="w-4 h-4" />
            </button>
            <button
              class="p-2 rounded-xl bg-rose-500 hover:bg-rose-600"
              title="退出"
              @click="doLogout"
            >
              <LogOut class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Mode-specific navigation -->
        <nav class="max-w-7xl mx-auto px-4 pb-2 flex flex-wrap gap-2">
          <template v-for="item in admin ? adminNav : childNav" :key="item.to">
            <router-link
              :to="item.to"
              class="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors"
              :class="
                $route.path === item.to
                  ? 'bg-white text-indigo-700'
                  : 'bg-indigo-700/60 text-indigo-100 hover:bg-indigo-700'
              "
            >
              <component :is="item.icon" class="w-4 h-4" />
              {{ item.label }}
            </router-link>
          </template>
        </nav>
      </header>

      <main class="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <router-view />
      </main>

      <footer class="border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        个人成长与决策沙盒系统 · Local Sandbox App
      </footer>
    </template>

    <!-- Login / public -->
    <router-view v-else />

    <!-- Parent PIN modal -->
    <div
      v-if="showPin"
      class="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4"
      @click.self="showPin = false"
    >
      <div class="card max-w-sm w-full text-center">
        <Lock class="w-8 h-8 mx-auto text-indigo-600" />
        <h3 class="text-lg font-bold mt-2">家长模式</h3>
        <p class="text-sm text-slate-500 mb-3">输入家长 PIN 码（默认 0000，可在设置中修改）</p>
        <input
          v-model="pin"
          type="password"
          inputmode="numeric"
          maxlength="6"
          placeholder="••••"
          class="input text-center text-2xl tracking-[0.4rem]"
          @keyup.enter="activateParent"
        />
        <div class="flex gap-2 justify-center mt-4">
          <button class="btn-primary" :disabled="pinBusy || !pin" @click="activateParent">进入</button>
          <button class="btn-ghost" @click="showPin = false">取消</button>
        </div>
      </div>
    </div>

    <div
      v-if="store.toast"
      class="fixed left-1/2 bottom-6 -translate-x-1/2 bg-slate-900 text-white px-5 py-2.5 rounded-full font-semibold shadow-lg z-50"
    >
      {{ store.toast }}
    </div>
    <div
      v-if="store.error"
      class="fixed left-1/2 bottom-6 -translate-x-1/2 bg-rose-600 text-white px-5 py-2.5 rounded-full font-semibold shadow-lg z-50"
    >
      ⚠️ {{ store.error }}
    </div>
  </div>
</template>
