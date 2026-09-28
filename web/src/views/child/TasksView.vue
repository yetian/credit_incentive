<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { CheckCircle2, Flame, Trophy, Target } from 'lucide-vue-next';
import { api, type Streak, type Task } from '../../api';
import { notify, fail, refresh } from '../../store';

const tasks = ref<Task[]>([]);
const streaks = ref<Streak[]>([]);
const busy = ref(false);

async function load() {
  const [t, s] = await Promise.all([api.tasks(), api.streaks()]);
  tasks.value = t.tasks;
  streaks.value = s.streaks;
}

function streakFor(id: number): Streak | undefined {
  return streaks.value.find((s) => s.task_id === id);
}

async function checkin(task: Task) {
  busy.value = true;
  try {
    const res = await api.checkin(task.id);
    notify(`✅ +${res.credit_awarded} · 🔥${res.streak}天`);
    if (res.unlocked_badges?.length) notify(`🏅 ${res.unlocked_badges.map((b) => b.emoji).join('')}`);
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
    <div class="card">
      <div class="flex items-center gap-2">
        <CheckCircle2 class="w-6 h-6 text-indigo-600" />
        <h1 class="text-xl font-bold">今日打卡</h1>
      </div>
      <p class="text-sm text-slate-500">任务由家长布置，完成即可赚取 Credit。</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div
        v-for="t in tasks"
        :key="t.id"
        class="card flex items-center justify-between hover:border-indigo-300 transition-colors"
      >
        <div class="flex items-center gap-3">
          <div
            class="p-2.5 rounded-xl"
            :class="t.kind === 'bounty' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'"
          >
            <component :is="t.kind === 'bounty' ? Target : CheckCircle2" class="w-6 h-6" />
          </div>
          <div>
            <p class="font-bold">{{ t.title }}</p>
            <p class="text-xs text-slate-400">{{ t.description || (t.kind === 'bounty' ? '悬赏任务' : '日常习惯') }}</p>
            <span v-if="streakFor(t.id)?.current_streak" class="chip bg-orange-50 text-orange-600 mt-1">
              <Flame class="w-3 h-3" /> {{ streakFor(t.id)?.current_streak }} 天连击
            </span>
          </div>
        </div>
        <div class="text-right">
          <p class="font-bold" :class="t.kind === 'bounty' ? 'text-amber-600' : 'text-indigo-600'">
            +{{ t.base_credit }}
          </p>
          <button class="btn-green mt-1" :disabled="busy" @click="checkin(t)">打卡</button>
        </div>
      </div>
      <p v-if="!tasks.length" class="text-sm text-slate-500">还没有任务。</p>
    </div>

    <!-- Streaks -->
    <div v-if="streaks.length" class="card">
      <div class="flex items-center gap-2 mb-3">
        <Trophy class="w-5 h-5 text-amber-500" />
        <h2 class="font-bold">连击记录</h2>
      </div>
      <div class="space-y-2">
        <div v-for="s in streaks" :key="s.task_id" class="flex items-center justify-between text-sm">
          <span>{{ s.title }}</span>
          <span class="chip bg-orange-50 text-orange-600">
            🔥 当前 {{ s.current_streak }} · 最佳 {{ s.best_streak }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
