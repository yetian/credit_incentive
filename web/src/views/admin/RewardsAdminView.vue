<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Gift, Plus, Rocket, Eye, EyeOff } from 'lucide-vue-next';
import { api, type Asset } from '../../api';
import { notify, fail } from '../../store';

const assets = ref<Asset[]>([]);
const busy = ref(false);
const edits = ref<Record<number, { price?: number; income_multiplier?: number }>>({});
const form = ref({ name: '', description: '', price: 40, income_multiplier: 1.1 });

async function load() {
  const res = await api.allAssets();
  assets.value = res.assets;
  for (const a of assets.value) edits.value[a.id] = {};
}

async function create() {
  busy.value = true;
  try {
    await api.createAsset({
      name: form.value.name,
      description: form.value.description || undefined,
      price: Number(form.value.price),
      income_multiplier: Number(form.value.income_multiplier),
    });
    notify('🧰 已上架奖励/工具');
    form.value = { name: '', description: '', price: 40, income_multiplier: 1.1 };
    await load();
  } catch (e) {
    fail((e as Error).message);
  } finally {
    busy.value = false;
  }
}

async function toggleSale(a: Asset) {
  try {
    await api.updateAsset(a.id, { for_sale: !a.for_sale });
    notify(a.for_sale ? '已下架' : '已上架');
    await load();
  } catch (e) {
    fail((e as Error).message);
  }
}

async function save(a: Asset) {
  const e = edits.value[a.id] ?? {};
  if (e.price === undefined && e.income_multiplier === undefined) return;
  try {
    await api.updateAsset(a.id, e);
    notify('✅ 已更新');
    await load();
  } catch (err) {
    fail((err as Error).message);
  }
}

onMounted(load);
</script>

<template>
  <div class="space-y-6">
    <div class="card flex items-center gap-2">
      <Gift class="w-6 h-6 text-purple-600" />
      <div>
        <h1 class="text-xl font-bold">奖励 / 商店管理</h1>
        <p class="text-sm text-slate-500">奖励与生产力工具由家长上架，孩子用 Credit 兑换。</p>
      </div>
    </div>

    <div class="card space-y-3">
      <h2 class="font-bold">➕ 上架新奖励 / 工具</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="sm:col-span-2">
          <label class="text-xs font-semibold text-slate-500">名称</label>
          <input v-model="form.name" class="input" placeholder="例如：周末游乐园门票 / 钢琴" />
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-500">价格 (Credit)</label>
          <input v-model.number="form.price" type="number" min="0" class="input" />
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-500">收益乘数 (工具用)</label>
          <input v-model.number="form.income_multiplier" type="number" step="0.05" min="1" class="input" />
        </div>
        <div class="sm:col-span-2">
          <label class="text-xs font-semibold text-slate-500">说明</label>
          <input v-model="form.description" class="input" placeholder="可选" />
        </div>
      </div>
      <button class="btn-primary" :disabled="busy || !form.name" @click="create"><Plus class="w-4 h-4" /> 上架</button>
    </div>

    <div class="card">
      <h2 class="font-bold mb-3">🏬 商店目录</h2>
      <div class="space-y-3">
        <div
          v-for="a in assets"
          :key="a.id"
          class="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-slate-200"
        >
          <div class="flex-1 min-w-[180px]">
            <div class="flex items-center gap-2">
              <b>{{ a.name }}</b>
              <span class="chip bg-purple-50 text-purple-600"><Rocket class="w-3 h-3" /> {{ a.income_multiplier }}x</span>
              <span v-if="a.owner_tenant_id" class="chip bg-slate-100 text-slate-500">已售给 #{{ a.owner_tenant_id }}</span>
            </div>
            <p class="text-xs text-slate-400">{{ a.description || '—' }}</p>
          </div>
          <div class="flex items-center gap-2">
            <input v-model.number="edits[a.id].price" type="number" :placeholder="String(a.price)" class="input max-w-[90px]" />
            <input v-model.number="edits[a.id].income_multiplier" type="number" step="0.05" :placeholder="String(a.income_multiplier)" class="input max-w-[90px]" />
            <button class="btn-ghost text-xs" @click="save(a)">保存</button>
            <button
              class="text-xs"
              :class="a.for_sale ? 'btn-red' : 'btn-green'"
              :disabled="!!a.owner_tenant_id"
              :title="a.owner_tenant_id ? '已被孩子拥有，无法上下架' : ''"
              @click="toggleSale(a)"
            >
              <component :is="a.for_sale ? EyeOff : Eye" class="w-3.5 h-3.5" />
              {{ a.for_sale ? '下架' : '上架' }}
            </button>
          </div>
        </div>
        <p v-if="!assets.length" class="text-sm text-slate-500">还没有奖励。</p>
      </div>
    </div>
  </div>
</template>
