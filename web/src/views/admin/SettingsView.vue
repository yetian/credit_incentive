<script setup lang="ts">
import { computed, ref } from 'vue';
import { Settings, KeyRound, Save } from 'lucide-vue-next';
import { store, changeOwnPin, notify, fail } from '../../store';

const profile = computed(() => store.profile);
const pin = ref('');
const pin2 = ref('');
const busy = ref(false);

async function save() {
  if (pin.value.length < 4) return fail('PIN 至少 4 位');
  if (pin.value !== pin2.value) return fail('两次输入不一致');
  busy.value = true;
  try {
    await changeOwnPin(pin.value);
    notify('🔑 PIN 已更新');
    pin.value = '';
    pin2.value = '';
  } catch (e) {
    fail((e as Error).message);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card flex items-center gap-2">
      <Settings class="w-6 h-6 text-indigo-600" />
      <div>
        <h1 class="text-xl font-bold">设置</h1>
        <p class="text-sm text-slate-500">修改家长 PIN 码（默认 0000）。</p>
      </div>
    </div>

    <div class="card max-w-md space-y-3">
      <div class="flex items-center gap-2 text-sm">
        <KeyRound class="w-5 h-5 text-amber-500" />
        <span>当前家长：<b>{{ profile?.tenant.name }}</b> ({{ profile?.tenant.role }})</span>
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-500">新 PIN 码</label>
        <input v-model="pin" type="password" inputmode="numeric" maxlength="6" class="input" placeholder="••••" />
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-500">确认新 PIN</label>
        <input v-model="pin2" type="password" inputmode="numeric" maxlength="6" class="input" placeholder="••••" />
      </div>
      <button class="btn-primary" :disabled="busy || !pin" @click="save"><Save class="w-4 h-4" /> 保存</button>
    </div>
  </div>
</template>
