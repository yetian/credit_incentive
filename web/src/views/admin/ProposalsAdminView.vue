<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ClipboardCheck, Check, X, TrendingUp } from 'lucide-vue-next';
import { api, type Proposal } from '../../api';
import { notify, fail, refresh } from '../../store';

const proposals = ref<Proposal[]>([]);
const settleInput = ref<Record<number, number>>({});

const pending = computed(() => proposals.value.filter((p) => p.status === 'pending'));
const approved = computed(() => proposals.value.filter((p) => p.status === 'approved' && !p.settled_at));
const archived = computed(() => proposals.value.filter((p) => p.status === 'rejected' || p.settled_at));

async function load() {
  proposals.value = (await api.proposals(false)).proposals;
}

async function review(id: number, decision: 'approved' | 'rejected') {
  try {
    await api.reviewProposal(id, decision);
    notify(decision === 'approved' ? '✅ 已批准并拨款' : '❌ 已驳回');
    await Promise.all([load(), refresh()]);
  } catch (e) {
    fail((e as Error).message);
  }
}

async function settle(p: Proposal) {
  try {
    await api.settleProposal(p.id, Number(settleInput.value[p.id] ?? 0));
    notify('💹 已结算');
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
      <ClipboardCheck class="w-6 h-6 text-indigo-600" />
      <div>
        <h1 class="text-xl font-bold">提案审批</h1>
        <p class="text-sm text-slate-500">审批孩子的提案、发放预算并结算收益。</p>
      </div>
    </div>

    <div class="card">
      <h2 class="font-bold mb-3">⏳ 待审批 ({{ pending.length }})</h2>
      <div v-for="p in pending" :key="p.id" class="p-4 rounded-xl border border-amber-200 bg-amber-50/40 mb-3">
        <div class="flex items-center justify-between">
          <b>{{ p.title }}</b>
          <span class="chip bg-slate-100 text-slate-600">👤 成员 #{{ p.tenant_id }}</span>
        </div>
        <p class="text-xs text-slate-600 mt-1">{{ p.description || '—' }}</p>
        <div class="flex gap-2 mt-2 text-xs">
          <span class="chip bg-amber-50 text-amber-700">💵 预算 {{ p.budget_requested }}</span>
          <span class="chip bg-emerald-50 text-emerald-700">🎯 预期 {{ p.expected_return }}</span>
        </div>
        <div class="flex gap-2 mt-3">
          <button class="btn-green" @click="review(p.id, 'approved')"><Check class="w-4 h-4" /> 批准并拨款</button>
          <button class="btn-red" @click="review(p.id, 'rejected')"><X class="w-4 h-4" /> 驳回</button>
        </div>
      </div>
      <p v-if="!pending.length" class="text-sm text-slate-500">没有待审提案 🎉</p>
    </div>

    <div class="card">
      <h2 class="font-bold mb-3">💹 待结算 ({{ approved.length }})</h2>
      <div v-for="p in approved" :key="p.id" class="flex flex-wrap items-center justify-between gap-2 py-2 border-t border-slate-100">
        <div>
          <b>{{ p.title }}</b>
          <span class="text-xs text-slate-500 ml-2">预算 {{ p.budget_requested }} · 预期 {{ p.expected_return }}</span>
        </div>
        <div class="flex items-center gap-2">
          <input v-model.number="settleInput[p.id]" type="number" placeholder="实际收益" class="input max-w-[140px]" />
          <button class="btn-amber" @click="settle(p)"><TrendingUp class="w-4 h-4" /> 结算</button>
        </div>
      </div>
      <p v-if="!approved.length" class="text-sm text-slate-500">暂无待结算项目。</p>
    </div>

    <div v-if="archived.length" class="card">
      <h2 class="font-bold mb-3">📁 历史</h2>
      <div v-for="p in archived" :key="p.id" class="flex justify-between py-1.5 border-t border-slate-100 text-sm">
        <span>{{ p.title }}</span>
        <span class="text-slate-500">
          {{ p.status === 'rejected' ? '❌ 已驳回' : `✅ 结算 ${p.actual_return}` }}
        </span>
      </div>
    </div>
  </div>
</template>
