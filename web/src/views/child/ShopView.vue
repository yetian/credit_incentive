<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ShoppingBag, Rocket, Wrench, Wallet } from 'lucide-vue-next';
import { api, type Asset } from '../../api';
import { store, notify, fail, refresh } from '../../store';
import { money } from '../../utils';

const market = ref<Asset[]>([]);
const mine = ref<Asset[]>([]);
const busy = ref(false);

const balance = computed(() => store.profile?.account.liquid_balance ?? 0);

async function load() {
  const [m, own] = await Promise.all([api.assets(true), api.myAssets()]);
  market.value = m.assets;
  mine.value = own.assets;
}

async function buy(a: Asset) {
  if (!confirm(`花费 ${a.price} Credit 兑换「${a.name}」?`)) return;
  busy.value = true;
  try {
    const res = await api.purchaseAsset(a.id);
    notify(`🛍️ 已兑换 ${a.name} · 效率 ${res.income_multiplier}x`);
    await Promise.all([load(), refresh()]);
  } catch (e) {
    fail((e as Error).message);
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="space-y-6">
    <div class="card flex items-center justify-between">
      <div class="flex items-center gap-2">
        <ShoppingBag class="w-6 h-6 text-purple-600" />
        <div>
          <h1 class="text-xl font-bold">积分兑换商店</h1>
          <p class="text-sm text-slate-500">用 Credit 兑换奖励与生产力工具。</p>
        </div>
      </div>
      <span class="chip bg-blue-50 text-blue-600"><Wallet class="w-4 h-4" /> {{ money(balance) }}</span>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="a in market" :key="a.id" class="card flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between">
            <h3 class="font-bold">{{ a.name }}</h3>
            <span class="chip bg-purple-50 text-purple-600"><Rocket class="w-3 h-3" /> {{ a.income_multiplier }}x</span>
          </div>
          <p class="text-xs text-slate-500 mt-1">{{ a.description || '奖励 / 工具' }}</p>
        </div>
        <div class="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <span class="font-bold text-slate-700">{{ money(a.price) }} C</span>
          <button class="btn-primary" :disabled="busy || balance < a.price" @click="buy(a)">
            {{ balance < a.price ? '余额不足' : '兑换' }}
          </button>
        </div>
      </div>
      <p v-if="!market.length" class="text-sm text-slate-500">商店暂无上架奖励。</p>
    </div>

    <div v-if="mine.length" class="card">
      <div class="flex items-center gap-2 mb-3">
        <Wrench class="w-5 h-5 text-purple-600" />
        <h2 class="font-bold">我的资产</h2>
      </div>
      <div class="flex flex-wrap gap-2">
        <span v-for="a in mine" :key="a.id" class="chip bg-slate-100 text-slate-700">
          🧰 {{ a.name }} · {{ a.income_multiplier }}x
        </span>
      </div>
    </div>
  </div>
</template>
