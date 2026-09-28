<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { PiggyBank, HandCoins, Receipt } from 'lucide-vue-next';
import { api, type Loan, type Transaction } from '../../api';
import { store, notify, fail, refresh } from '../../store';
import { money, txEmoji } from '../../utils';

const loans = ref<Loan[]>([]);
const transactions = ref<Transaction[]>([]);
const amount = ref(10);
const principal = ref(50);
const dueDate = ref('');
const repayAmount = ref<Record<number, number>>({});
const busy = ref(false);

async function load() {
  const [l, t] = await Promise.all([api.loans(), api.transactions()]);
  loans.value = l.loans;
  transactions.value = t.transactions;
}

async function run(fn: () => Promise<void>) {
  busy.value = true;
  try {
    await fn();
    await Promise.all([load(), refresh()]);
  } catch (e) {
    fail((e as Error).message);
  } finally {
    busy.value = false;
  }
}

const deposit = () => run(async () => { await api.deposit(Number(amount.value)); notify('🏦 已存入'); });
const withdraw = () => run(async () => { await api.withdraw(Number(amount.value)); notify('💸 已取出'); });
const accrue = () => run(async () => { const r = await api.accrueSavings(); notify(`🌱 复利 +${money(r.interest)}`); });
const requestLoan = () => run(async () => {
  const r = await api.requestLoan(Number(principal.value), dueDate.value || undefined);
  notify(`💳 贷款到账 ${money(r.loan.principal)}`);
});
const repay = (loan: Loan) => run(async () => {
  const v = repayAmount.value[loan.id] ?? loan.outstanding;
  const r = await api.repayLoan(loan.id, Number(v));
  notify(`✅ 已还 ${money(r.paid)} · 信用 ${r.credit_score}`);
});
const accrueLoan = (loan: Loan) => run(async () => {
  const r = await api.accrueLoan(loan.id);
  notify(`📉 利息 +${money(r.interest)}`);
});

const statusCls: Record<string, string> = {
  active: 'bg-indigo-100 text-indigo-700',
  repaid: 'bg-emerald-100 text-emerald-700',
  defaulted: 'bg-rose-100 text-rose-700',
};

onMounted(load);
</script>

<template>
  <div v-if="store.profile" class="space-y-6">
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="card">
        <p class="text-xs font-semibold text-slate-400 uppercase">现金流</p>
        <h2 class="text-2xl font-black">{{ money(store.profile.account.liquid_balance) }}</h2>
      </div>
      <div class="card">
        <p class="text-xs font-semibold text-slate-400 uppercase">复利储蓄</p>
        <h2 class="text-2xl font-black">{{ money(store.profile.account.savings_balance) }}</h2>
      </div>
      <div class="card">
        <p class="text-xs font-semibold text-slate-400 uppercase">信用分 / 可贷</p>
        <h2 class="text-2xl font-black">{{ store.profile.credit_score }}</h2>
        <span class="text-xs text-slate-500">额度 {{ money(store.profile.loan_limit) }}</span>
      </div>
    </div>

    <div class="card space-y-3">
      <div class="flex items-center gap-2">
        <PiggyBank class="w-6 h-6 text-emerald-600" />
        <h2 class="text-lg font-bold">复利储蓄 · 延迟满足</h2>
      </div>
      <div class="flex flex-wrap gap-2">
        <input v-model.number="amount" type="number" min="0" class="input max-w-[140px]" />
        <button class="btn-green" :disabled="busy" @click="deposit">存入</button>
        <button class="btn-ghost" :disabled="busy" @click="withdraw">取出</button>
        <button class="btn-amber" :disabled="busy" @click="accrue">🌱 结算本周复利</button>
      </div>
    </div>

    <div class="card space-y-3">
      <div class="flex items-center gap-2">
        <HandCoins class="w-6 h-6 text-indigo-600" />
        <h2 class="text-lg font-bold">贷款 · 信用</h2>
      </div>
      <div class="flex flex-wrap gap-2">
        <input v-model.number="principal" type="number" min="1" class="input max-w-[140px]" />
        <input v-model="dueDate" type="date" class="input max-w-[180px]" />
        <button class="btn-primary" :disabled="busy" @click="requestLoan">申请贷款</button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-slate-400 text-xs uppercase">
            <tr>
              <th class="text-left py-2">#</th><th class="text-left">本金</th><th class="text-left">未还</th>
              <th class="text-left">状态</th><th class="text-left">到期</th><th class="text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in loans" :key="l.id" class="border-t border-slate-100">
              <td class="py-2">{{ l.id }}</td>
              <td>{{ money(l.principal) }}</td>
              <td>{{ money(l.outstanding) }}</td>
              <td><span class="chip" :class="statusCls[l.status]">{{ l.status }}</span></td>
              <td class="text-slate-500">{{ l.due_date || '-' }}</td>
              <td>
                <div v-if="l.status === 'active'" class="flex gap-1.5">
                  <input v-model.number="repayAmount[l.id]" type="number" :placeholder="String(l.outstanding)" class="input max-w-[90px]" />
                  <button class="btn-green" :disabled="busy" @click="repay(l)">还款</button>
                  <button class="btn-ghost" :disabled="busy" @click="accrueLoan(l)">计息</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!loans.length" class="text-sm text-slate-500">暂无贷款。</p>
      </div>
    </div>

    <div class="card">
      <div class="flex items-center gap-2 mb-3">
        <Receipt class="w-5 h-5 text-slate-600" />
        <h2 class="font-bold">交易流水</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-slate-400 text-xs uppercase">
            <tr><th class="text-left py-2">类型</th><th class="text-left">说明</th><th class="text-left">金额</th><th class="text-left">时间</th></tr>
          </thead>
          <tbody>
            <tr v-for="t in transactions" :key="t.id" class="border-t border-slate-100">
              <td class="py-2">{{ txEmoji(t.type) }} {{ t.type }}</td>
              <td class="text-slate-500">{{ t.note }}</td>
              <td :class="t.amount >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'">{{ money(t.amount) }}</td>
              <td class="text-slate-400">{{ t.created_at }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="!transactions.length" class="text-sm text-slate-500">暂无流水。</p>
      </div>
    </div>
  </div>
</template>
