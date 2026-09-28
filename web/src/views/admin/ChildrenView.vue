<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  Wallet,
  PiggyBank,
  Star,
  CheckCircle2,
  Undo2,
  ShieldCheck,
} from 'lucide-vue-next';
import { api, type ChildDashboard } from '../../api';
import { notify, fail, refresh, roleEmoji } from '../../store';
import { money } from '../../utils';

const children = ref<ChildDashboard[]>([]);
const busy = ref(false);
const adjust = ref<Record<number, { liquid_delta?: number; credit_score?: number }>>({});

async function load() {
  children.value = (await api.adminChildren()).children;
  for (const c of children.value) if (!adjust.value[c.tenant.id]) adjust.value[c.tenant.id] = {};
}

async function applyAdjust(child: ChildDashboard) {
  const a = adjust.value[child.tenant.id] ?? {};
  if (a.liquid_delta === undefined && a.credit_score === undefined) return fail('请填写调整值');
  busy.value = true;
  try {
    await api.adjustChild(child.tenant.id, a);
    notify('✅ 已调整账户');
    adjust.value[child.tenant.id] = {};
    await Promise.all([load(), refresh()]);
  } catch (e) {
    fail((e as Error).message);
  } finally {
    busy.value = false;
  }
}

async function revoke(child: ChildDashboard, id: number) {
  if (!confirm('撤销这笔打卡并扣回 Credit?')) return;
  busy.value = true;
  try {
    const r = await api.revokeCheckin(id);
    notify(`↩️ 已撤销，扣回 ${money(r.reversed_amount)}`);
    await Promise.all([load(), refresh()]);
  } catch (e) {
    fail((e as Error).message);
  } finally {
    busy.value = false;
  }
}

async function review(id: number, decision: 'approved' | 'rejected') {
  try {
    await api.reviewProposal(id, decision);
    notify(decision === 'approved' ? '✅ 已批准' : '❌ 已驳回');
    await Promise.all([load(), refresh()]);
  } catch (e) {
    fail((e as Error).message);
  }
}

onMounted(load);
</script>

<template>
  <div class="space-y-6">
    <div class="card flex items-center gap-2">
      <ShieldCheck class="w-6 h-6 text-indigo-600" />
      <div>
        <h1 class="text-xl font-bold">孩子看板</h1>
        <p class="text-sm text-slate-500">全局管理：账户、信用、打卡撤销与提案审批。</p>
      </div>
    </div>

    <div v-for="child in children" :key="child.tenant.id" class="card space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold">
          {{ roleEmoji(child.tenant.role, child.tenant.game_role) }} {{ child.tenant.name }}
          <span class="chip bg-slate-100 text-slate-600 ml-1">{{ child.tenant.game_role }}</span>
        </h2>
        <span class="text-xs text-slate-400">可贷 {{ money(child.loan_limit) }}</span>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="rounded-xl border border-slate-200 p-3">
          <p class="text-xs text-slate-400 flex items-center gap-1"><Wallet class="w-3.5 h-3.5" /> 现金流</p>
          <b class="text-lg">{{ money(child.account.liquid_balance) }}</b>
        </div>
        <div class="rounded-xl border border-slate-200 p-3">
          <p class="text-xs text-slate-400 flex items-center gap-1"><PiggyBank class="w-3.5 h-3.5" /> 储蓄</p>
          <b class="text-lg">{{ money(child.account.savings_balance) }}</b>
        </div>
        <div class="rounded-xl border border-slate-200 p-3">
          <p class="text-xs text-slate-400 flex items-center gap-1"><Star class="w-3.5 h-3.5" /> 信用</p>
          <b class="text-lg">{{ child.credit_score }}</b>
        </div>
        <div class="rounded-xl border border-slate-200 p-3">
          <p class="text-xs text-slate-400 flex items-center gap-1"><CheckCircle2 class="w-3.5 h-3.5" /> 打卡</p>
          <b class="text-lg">{{ child.stats.total }}</b>
          <span v-if="child.stats.revoked" class="text-xs text-rose-500"> 撤销 {{ child.stats.revoked }}</span>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <input v-model.number="adjust[child.tenant.id].liquid_delta" type="number" placeholder="余额增减 (+/-)" class="input max-w-[170px]" />
        <input v-model.number="adjust[child.tenant.id].credit_score" type="number" placeholder="信用分设为" class="input max-w-[150px]" />
        <button class="btn-amber" :disabled="busy" @click="applyAdjust(child)">调整账户</button>
      </div>

      <div>
        <h3 class="font-semibold text-sm mb-2">最近打卡</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-slate-400 text-xs uppercase">
              <tr><th class="text-left py-2">#</th><th class="text-left">日期</th><th class="text-left">Credit</th><th class="text-left">连击</th><th class="text-left">状态</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="c in child.recent_checkins" :key="c.id" class="border-t border-slate-100">
                <td class="py-2">{{ c.id }}</td>
                <td>{{ c.checked_on || '-' }}</td>
                <td>+{{ money(c.credit_awarded) }}</td>
                <td>🔥 {{ c.streak }}</td>
                <td>
                  <span class="chip" :class="c.is_revoked ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'">
                    {{ c.is_revoked ? '已撤销' : '有效' }}
                  </span>
                </td>
                <td>
                  <button v-if="!c.is_revoked" class="btn-red text-xs" :disabled="busy" @click="revoke(child, c.id)">
                    <Undo2 class="w-3.5 h-3.5" /> 撤销
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="!child.recent_checkins.length" class="text-sm text-slate-500">暂无打卡。</p>
        </div>
      </div>

      <div v-if="child.pending_proposals.length">
        <h3 class="font-semibold text-sm mb-2">待审提案</h3>
        <div v-for="p in child.pending_proposals" :key="p.id" class="flex items-center justify-between py-1.5 border-t border-slate-100">
          <span class="text-sm">{{ p.title }} · 💵{{ p.budget_requested }} / 🎯{{ p.expected_return }}</span>
          <span class="flex gap-1.5">
            <button class="btn-green text-xs" @click="review(p.id, 'approved')">批准</button>
            <button class="btn-red text-xs" @click="review(p.id, 'rejected')">驳回</button>
          </span>
        </div>
      </div>
    </div>

    <p v-if="!children.length" class="text-sm text-slate-500">还没有孩子账号，去「成员」创建。</p>
  </div>
</template>
