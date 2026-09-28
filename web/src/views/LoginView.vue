<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Gamepad2, User, Lock } from 'lucide-vue-next';
import { api, type Tenant } from '../api';
import { store, login, fail, roleEmoji } from '../store';

const router = useRouter();
const tenants = ref<Tenant[]>([]);
const busy = ref<number | null>(null);
const pinFor = ref<number | null>(null);
const pin = ref('');

async function load() {
  try {
    tenants.value = (await api.listTenants()).tenants;
  } catch (e) {
    fail((e as Error).message);
  }
}

async function pick(tenant: Tenant) {
  if (tenant.role === 'PARENT') {
    pinFor.value = tenant.id;
    pin.value = '';
    return;
  }
  await doLogin(tenant.id);
}

async function doLogin(tenantId: number, code?: string) {
  busy.value = tenantId;
  try {
    await login(tenantId, code);
    router.push(store.profile?.tenant.role === 'PARENT' ? '/admin' : '/');
  } catch (e) {
    fail((e as Error).message);
  } finally {
    busy.value = null;
    pinFor.value = null;
  }
}

onMounted(load);
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50">
    <div class="card max-w-md w-full">
      <div class="text-center mb-5">
        <Gamepad2 class="w-12 h-12 mx-auto text-indigo-600" />
        <h1 class="text-2xl font-black mt-2">成长沙盒 Sandbox</h1>
        <p class="text-sm text-slate-500">选择身份开始 · 打卡赚钱 · 学习理财与决策</p>
      </div>

      <div class="space-y-3">
        <div v-for="t in tenants" :key="t.id">
          <button
            class="w-full flex items-center gap-3 rounded-2xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm p-3.5 text-left transition-all disabled:opacity-50"
            :disabled="busy === t.id"
            @click="pick(t)"
          >
            <span
              class="p-2 rounded-xl"
              :class="t.role === 'PARENT' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'"
            >
              <component :is="t.role === 'PARENT' ? Lock : User" class="w-6 h-6" />
            </span>
            <span class="flex-1">
              <strong class="block">{{ t.name }}</strong>
              <small class="text-slate-500">
                {{ t.role }} · {{ t.game_role }} · ⭐ {{ t.credit_score }}
              </small>
            </span>
            <span class="text-2xl">{{ roleEmoji(t.role, t.game_role) }}</span>
          </button>

          <div v-if="pinFor === t.id" class="flex gap-2 mt-2 justify-center">
            <input
              v-model="pin"
              type="password"
              inputmode="numeric"
              maxlength="6"
              placeholder="家长 PIN"
              class="input max-w-[150px] text-center"
              @keyup.enter="doLogin(t.id, pin)"
            />
            <button class="btn-primary" :disabled="!pin" @click="doLogin(t.id, pin)">进入</button>
          </div>
        </div>
      </div>

      <p v-if="!tenants.length" class="text-sm text-slate-500 text-center mt-4">
        还没有成员。运行 <code class="bg-slate-100 px-1 rounded">npm run seed</code> 创建示例家庭。
      </p>
      <p v-if="store.error" class="text-sm text-rose-600 text-center mt-3">⚠️ {{ store.error }}</p>
    </div>
  </div>
</template>
