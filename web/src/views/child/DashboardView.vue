<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  Wallet,
  PiggyBank,
  Wrench,
  Award,
  CheckCircle2,
  Lightbulb,
  Landmark,
  ShoppingBag,
  ArrowRight,
  Flame,
  Plus,
} from 'lucide-vue-next';
import { api, type Asset, type Proposal, type Task } from '../../api';
import { store, refresh, notify, fail } from '../../store';
import { money } from '../../utils';

const router = useRouter();
const tasks = ref<Task[]>([]);
const assets = ref<Asset[]>([]);
const proposals = ref<Proposal[]>([]);
const market = ref<Asset[]>([]);
const busy = ref(false);

const profile = computed(() => store.profile);
const toolsValue = computed(() => assets.value.reduce((s, a) => s + a.price, 0));
const myProposals = computed(() => proposals.value.filter((p) => p.tenant_id === profile.value?.tenant.id));
const pendingCount = computed(() => myProposals.value.filter((p) => p.status === 'pending').length);

async function load() {
  const [t, a, p, m] = await Promise.all([
    api.tasks(),
    api.myAssets(),
    api.proposals(true),
    api.assets(true),
  ]);
  tasks.value = t.tasks;
  assets.value = a.assets;
  proposals.value = p.proposals;
  market.value = m.assets;
  await refresh();
}

async function checkin(task: Task) {
  busy.value = true;
  try {
    const res = await api.checkin(task.id);
    notify(`✅ ${task.title} +${res.credit_awarded}${res.streak > 1 ? ` 🔥${res.streak}天` : ''}`);
    if (res.unlocked_badges?.length) notify(`🏅 ${res.unlocked_badges.map((b) => b.emoji).join('')}`);
    await load();
  } catch (e) {
    fail((e as Error).message);
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div v-if="profile" class="space-y-8">
    <!-- Financial overview -->
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="card flex items-center gap-4">
        <div class="p-3 bg-blue-50 text-blue-600 rounded-xl"><Wallet class="w-7 h-7" /></div>
        <div>
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">现金流</p>
          <h2 class="text-2xl font-black">{{ money(profile.account.liquid_balance) }}</h2>
        </div>
      </div>
      <div class="card flex items-center gap-4">
        <div class="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><PiggyBank class="w-7 h-7" /></div>
        <div>
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">复利储蓄</p>
          <h2 class="text-2xl font-black">{{ money(profile.account.savings_balance) }}</h2>
        </div>
      </div>
      <div class="card flex items-center gap-4">
        <div class="p-3 bg-purple-50 text-purple-600 rounded-xl"><Wrench class="w-7 h-7" /></div>
        <div>
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">工具与资产</p>
          <h2 class="text-2xl font-black">{{ money(toolsValue) }}</h2>
          <span class="text-xs text-purple-600">🚀 {{ profile.income_multiplier }}x 效率</span>
        </div>
      </div>
      <div class="card flex items-center gap-4">
        <div class="p-3 bg-amber-50 text-amber-600 rounded-xl"><Award class="w-7 h-7" /></div>
        <div>
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">信用评级 / 身份</p>
          <h2 class="text-lg font-bold">
            ⭐ {{ profile.credit_score }}
            <span class="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
              {{ profile.tenant.game_role }}
            </span>
          </h2>
        </div>
      </div>
    </section>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div class="lg:col-span-2 space-y-8">
        <!-- Routines -->
        <section class="card">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <CheckCircle2 class="w-6 h-6 text-indigo-600" />
              <h2 class="text-lg font-bold">执行者板块：日常习惯打卡</h2>
            </div>
            <span class="text-xs text-slate-500">{{ tasks.length }} 项任务</span>
          </div>

          <div class="space-y-3">
            <div
              v-for="t in tasks"
              :key="t.id"
              class="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200 hover:border-indigo-300 transition-all shadow-sm"
            >
              <div class="flex items-center gap-3">
                <button
                  class="w-9 h-9 rounded-full border-2 flex items-center justify-center transition-colors"
                  :class="t.kind === 'bounty' ? 'border-amber-400 text-amber-500' : 'border-indigo-400 text-indigo-600'"
                  :disabled="busy"
                  @click="checkin(t)"
                >
                  <CheckCircle2 class="w-5 h-5" />
                </button>
                <div>
                  <span class="font-medium">{{ t.title }}</span>
                  <p v-if="t.description" class="text-xs text-slate-400">{{ t.description }}</p>
                </div>
              </div>
              <span class="text-sm font-semibold" :class="t.kind === 'bounty' ? 'text-amber-600' : 'text-indigo-600'">
                {{ t.kind === 'bounty' ? '🎯 ' : '' }}+{{ t.base_credit }} Credit
              </span>
            </div>
            <p v-if="!tasks.length" class="text-sm text-slate-500">还没有任务，等家长布置吧。</p>
          </div>
        </section>

        <!-- Proposals -->
        <section class="card">
          <div class="flex items-center justify-between mb-4 gap-2">
            <div class="flex items-center gap-2">
              <Lightbulb class="w-6 h-6 text-amber-500" />
              <h2 class="text-lg font-bold">决策者板块：我的提案</h2>
            </div>
            <button class="btn-primary text-xs" @click="router.push('/proposals')">
              <Plus class="w-4 h-4" /> 提交新提案
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              v-for="p in myProposals.slice(0, 4)"
              :key="p.id"
              class="p-4 rounded-xl border border-amber-200 bg-amber-50/40"
            >
              <div class="flex justify-between items-start mb-2">
                <span class="chip bg-amber-100 text-amber-800">
                  {{ p.status === 'pending' ? '待审批' : p.status === 'approved' ? '进行中' : '已驳回' }}
                </span>
                <span class="text-xs text-amber-700">分红预计 +{{ p.expected_return }}</span>
              </div>
              <h3 class="font-bold">{{ p.title }}</h3>
              <p class="text-xs text-slate-600 mt-1">预算拨款: <b>{{ p.budget_requested }} Credit</b></p>
            </div>
            <p v-if="!myProposals.length" class="text-sm text-slate-500">还没有提案，点右上角发起一个吧。</p>
          </div>
          <p v-if="pendingCount" class="text-xs text-slate-500 mt-3">⏳ {{ pendingCount }} 个提案等待家长审批</p>
        </section>
      </div>

      <!-- Sidebar -->
      <div class="space-y-8">
        <section class="card space-y-4">
          <div class="flex items-center gap-2">
            <Landmark class="w-6 h-6 text-emerald-600" />
            <h2 class="text-lg font-bold">沙盒银行</h2>
          </div>
          <button
            class="w-full flex justify-between items-center rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-700"
            @click="router.push('/finance')"
          >
            划转资金 / 复利储蓄 <ArrowRight class="w-4 h-4" />
          </button>
          <button
            class="w-full flex justify-between items-center rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700"
            @click="router.push('/finance')"
          >
            申请微型贷款 <ArrowRight class="w-4 h-4" />
          </button>
        </section>

        <section class="card space-y-3">
          <div class="flex items-center gap-2">
            <ShoppingBag class="w-6 h-6 text-purple-600" />
            <h2 class="text-lg font-bold">积分兑换</h2>
          </div>
          <div
            v-for="a in market.slice(0, 3)"
            :key="a.id"
            class="flex justify-between items-center p-3 border border-slate-100 rounded-xl"
          >
            <div>
              <h4 class="text-sm font-bold">{{ a.name }}</h4>
              <p class="text-xs text-slate-400">{{ a.income_multiplier }}x 效率</p>
            </div>
            <button
              class="chip bg-purple-50 text-purple-600 border border-purple-200"
              @click="router.push('/shop')"
            >
              {{ a.price }} C
            </button>
          </div>
          <p v-if="!market.length" class="text-sm text-slate-500">商店暂无奖励。</p>
        </section>

        <section v-if="profile.streaks.length" class="card">
          <div class="flex items-center gap-2 mb-2">
            <Flame class="w-5 h-5 text-orange-500" />
            <h2 class="font-bold">连击</h2>
          </div>
          <div v-for="s in profile.streaks" :key="s.task_id" class="flex justify-between text-sm py-0.5">
            <span>{{ s.title }}</span>
            <span class="chip bg-orange-50 text-orange-600">🔥 {{ s.current_streak }}</span>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
