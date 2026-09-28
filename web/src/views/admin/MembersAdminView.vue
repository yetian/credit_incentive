<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Users, UserPlus } from 'lucide-vue-next';
import { api, type GameRole, type Role, type Tenant } from '../../api';
import { notify, fail } from '../../store';

const members = ref<Tenant[]>([]);
const name = ref('');
const newRole = ref<Role>('CHILD');
const busy = ref(false);

async function load() {
  members.value = (await api.members()).tenants;
}

async function create() {
  busy.value = true;
  try {
    await api.createMember(name.value, newRole.value);
    notify('👥 成员已创建');
    name.value = '';
    await load();
  } catch (e) {
    fail((e as Error).message);
  } finally {
    busy.value = false;
  }
}

async function changeRole(m: Tenant, role: Role) {
  try {
    await api.updateMember(m.id, { role });
    notify(`已设为 ${role}`);
    await load();
  } catch (e) {
    fail((e as Error).message);
  }
}

async function changeGameRole(m: Tenant, gameRole: GameRole) {
  try {
    await api.updateMember(m.id, { game_role: gameRole });
    notify(`成长角色 → ${gameRole}`);
    await load();
  } catch (e) {
    fail((e as Error).message);
  }
}

async function resetPin(m: Tenant) {
  const pin = prompt(`为 ${m.name} 设置新 PIN (4位数字)`, '0000');
  if (!pin) return;
  try {
    await api.updateMember(m.id, { pin_code: pin });
    notify('🔑 已更新 PIN');
  } catch (e) {
    fail((e as Error).message);
  }
}

onMounted(load);
</script>

<template>
  <div class="space-y-6">
    <div class="card flex items-center gap-2">
      <Users class="w-6 h-6 text-indigo-600" />
      <div>
        <h1 class="text-xl font-bold">成员管理</h1>
        <p class="text-sm text-slate-500">权限角色 (PARENT/CHILD) 与成长角色 (employee→ceo) 分开管理。</p>
      </div>
    </div>

    <div class="card space-y-3">
      <h2 class="font-bold flex items-center gap-2"><UserPlus class="w-5 h-5" /> 新建成员</h2>
      <div class="flex flex-wrap gap-2">
        <input v-model="name" class="input max-w-[220px]" placeholder="成员名字" />
        <select v-model="newRole" class="input max-w-[160px]">
          <option value="CHILD">CHILD</option>
          <option value="PARENT">PARENT</option>
        </select>
        <button class="btn-primary" :disabled="busy || !name" @click="create">创建</button>
      </div>
    </div>

    <div class="card overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="text-slate-400 text-xs uppercase">
          <tr>
            <th class="text-left py-2">成员</th><th class="text-left">权限</th><th class="text-left">成长角色</th>
            <th class="text-left">信用分</th><th class="text-left">PIN</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in members" :key="m.id" class="border-t border-slate-100">
            <td class="py-2 font-semibold">{{ m.name }}</td>
            <td>
              <select :value="m.role" class="input max-w-[130px]" @change="changeRole(m, ($event.target as HTMLSelectElement).value as Role)">
                <option value="CHILD">CHILD</option>
                <option value="PARENT">PARENT</option>
              </select>
            </td>
            <td>
              <select :value="m.game_role" class="input max-w-[140px]" @change="changeGameRole(m, ($event.target as HTMLSelectElement).value as GameRole)">
                <option value="employee">employee</option>
                <option value="contractor">contractor</option>
                <option value="ceo">ceo</option>
              </select>
            </td>
            <td>⭐ {{ m.credit_score }}</td>
            <td><button class="btn-ghost text-xs" @click="resetPin(m)">🔑 重置</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
