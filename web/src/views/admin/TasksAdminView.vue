<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ListChecks, Plus, Power } from 'lucide-vue-next';
import { api, type AdminTask, type ChildDashboard } from '../../api';
import { store, notify, fail, refresh } from '../../store';

const tasks = ref<AdminTask[]>([]);
const children = ref<ChildDashboard[]>([]);
const busy = ref(false);
const form = ref({ title: '', description: '', base_credit: 10, kind: 'habit', child_id: 0 });

async function load() {
  const [t, c] = await Promise.all([api.adminTasks(), api.adminChildren()]);
  tasks.value = t.tasks;
  children.value = c.children;
}

function ownerName(id: number | null): string {
  if (id === null) return '🌍 全局';
  if (id === store.profile?.tenant.id) return '👑 家长';
  return children.value.find((c) => c.tenant.id === id)?.tenant.name ?? `#${id}`;
}

async function create() {
  busy.value = true;
  try {
    await api.adminCreateTask({
      title: form.value.title,
      description: form.value.description || undefined,
      base_credit: Number(form.value.base_credit),
      kind: form.value.kind,
      child_id: form.value.child_id || null,
    });
    notify('🎉 任务已发布');
    form.value = { title: '', description: '', base_credit: 10, kind: 'habit', child_id: 0 };
    await Promise.all([load(), refresh()]);
  } catch (e) {
    fail((e as Error).message);
  } finally {
    busy.value = false;
  }
}

async function toggle(t: AdminTask) {
  try {
    await api.adminSetTaskActive(t.id, t.active === 0);
    await load();
  } catch (e) {
    fail((e as Error).message);
  }
}

onMounted(load);
</script>

<template>
  <div class="space-y-6">
    <div class="card flex items-center gap-2">
      <ListChecks class="w-6 h-6 text-indigo-600" />
      <div>
        <h1 class="text-xl font-bold">任务管理</h1>
        <p class="text-sm text-slate-500">任务与奖励由家长设定，孩子只能打卡。</p>
      </div>
    </div>

    <div class="card space-y-3">
      <h2 class="font-bold">➕ 发布任务</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="sm:col-span-2">
          <label class="text-xs font-semibold text-slate-500">标题</label>
          <input v-model="form.title" class="input" placeholder="任务名称" />
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-500">基础 Credit</label>
          <input v-model.number="form.base_credit" type="number" min="1" class="input" />
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-500">类型</label>
          <select v-model="form.kind" class="input">
            <option value="habit">✅ 日常习惯</option>
            <option value="bounty">🎯 悬赏任务</option>
          </select>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-500">指派给</label>
          <select v-model.number="form.child_id" class="input">
            <option :value="0">🌍 全局（所有孩子）</option>
            <option v-for="c in children" :key="c.tenant.id" :value="c.tenant.id">{{ c.tenant.name }}</option>
          </select>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-500">说明</label>
          <input v-model="form.description" class="input" placeholder="可选" />
        </div>
      </div>
      <button class="btn-primary" :disabled="busy || !form.title" @click="create">
        <Plus class="w-4 h-4" /> 发布
      </button>
    </div>

    <div class="card">
      <h2 class="font-bold mb-3">📋 全部任务</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-slate-400 text-xs uppercase">
            <tr><th class="text-left py-2">#</th><th class="text-left">标题</th><th class="text-left">类型</th><th class="text-left">Credit</th><th class="text-left">归属</th><th class="text-left">状态</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="t in tasks" :key="t.id" class="border-t border-slate-100">
              <td class="py-2">{{ t.id }}</td>
              <td>{{ t.title }}</td>
              <td>{{ t.kind === 'bounty' ? '🎯 悬赏' : '✅ 习惯' }}</td>
              <td>+{{ t.base_credit }}</td>
              <td class="text-slate-500">{{ ownerName(t.tenant_id) }}</td>
              <td>
                <span class="chip" :class="t.active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'">
                  {{ t.active ? '启用' : '停用' }}
                </span>
              </td>
              <td>
                <button class="btn-ghost text-xs" @click="toggle(t)">
                  <Power class="w-3.5 h-3.5" /> {{ t.active ? '停用' : '启用' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
