<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Lightbulb, Plus, Clock, CheckCircle2, XCircle } from 'lucide-vue-next';
import { api, type Proposal } from '../../api';
import { notify, fail } from '../../store';

const proposals = ref<Proposal[]>([]);
const busy = ref(false);
const showForm = ref(false);
const form = ref({ title: '', description: '', budget_requested: 20, expected_return: 30 });

const mine = computed(() => proposals.value);

async function load() {
  proposals.value = (await api.proposals(true)).proposals;
}

async function create() {
  busy.value = true;
  try {
    await api.createProposal({
      title: form.value.title,
      description: form.value.description || undefined,
      budget_requested: Number(form.value.budget_requested),
      expected_return: Number(form.value.expected_return),
    });
    notify('📈 提案已提交，等待家长审批');
    form.value = { title: '', description: '', budget_requested: 20, expected_return: 30 };
    showForm.value = false;
    await load();
  } catch (e) {
    fail((e as Error).message);
  } finally {
    busy.value = false;
  }
}

const statusMap: Record<string, { label: string; cls: string }> = {
  pending: { label: '待审批', cls: 'bg-slate-100 text-slate-600' },
  approved: { label: '已通过', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '已驳回', cls: 'bg-rose-100 text-rose-700' },
};

onMounted(load);
</script>

<template>
  <div class="space-y-6">
    <div class="card flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <Lightbulb class="w-6 h-6 text-amber-500" />
        <div>
          <h1 class="text-xl font-bold">我的提案</h1>
          <p class="text-sm text-slate-500">像 CEO 一样提计划、申请预算、赚取分红。</p>
        </div>
      </div>
      <button class="btn-primary" @click="showForm = !showForm">
        <Plus class="w-4 h-4" /> 新提案
      </button>
    </div>

    <div v-if="showForm" class="card space-y-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="sm:col-span-2">
          <label class="text-xs font-semibold text-slate-500">项目名称</label>
          <input v-model="form.title" class="input" placeholder="例如：周末摆摊卖柠檬水" />
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-500">申请预算</label>
          <input v-model.number="form.budget_requested" type="number" min="0" class="input" />
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-500">预期收益</label>
          <input v-model.number="form.expected_return" type="number" min="0" class="input" />
        </div>
        <div class="sm:col-span-2">
          <label class="text-xs font-semibold text-slate-500">说明</label>
          <input v-model="form.description" class="input" placeholder="可选" />
        </div>
      </div>
      <button class="btn-primary" :disabled="busy || !form.title" @click="create">提交提案</button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div v-for="p in mine" :key="p.id" class="card space-y-2">
        <div class="flex items-start justify-between">
          <h3 class="font-bold">{{ p.title }}</h3>
          <span class="chip" :class="statusMap[p.status].cls">
            <component
              :is="p.status === 'pending' ? Clock : p.status === 'approved' ? CheckCircle2 : XCircle"
              class="w-3 h-3"
            />
            {{ statusMap[p.status].label }}
          </span>
        </div>
        <p class="text-xs text-slate-500">{{ p.description || '—' }}</p>
        <div class="flex gap-2 text-xs pt-2 border-t border-slate-100">
          <span class="chip bg-amber-50 text-amber-700">💵 预算 {{ p.budget_requested }}</span>
          <span class="chip bg-emerald-50 text-emerald-700">🎯 预期 {{ p.expected_return }}</span>
          <span v-if="p.actual_return !== null" class="chip bg-indigo-50 text-indigo-700">📊 实际 {{ p.actual_return }}</span>
        </div>
      </div>
      <p v-if="!mine.length" class="text-sm text-slate-500">还没有提案。</p>
    </div>
  </div>
</template>
