import { config } from '../config';
import { accrueInterestForAll } from './savingsService';
import { accrueInterestForAllLoans, markOverdueLoans } from './loanService';

let timer: NodeJS.Timeout | null = null;

export interface CycleSummary {
  savings_accruals: number;
  loan_accruals: number;
  defaulted_loans: number;
}

export function runScheduledCycle(): CycleSummary {
  const savings = accrueInterestForAll();
  const loanAccruals = accrueInterestForAllLoans();
  const defaulted = markOverdueLoans();
  return {
    savings_accruals: savings.length,
    loan_accruals: loanAccruals.length,
    defaulted_loans: defaulted.length,
  };
}

export function startScheduler(): void {
  if (!config.scheduler.enabled) {
    console.log('[scheduler] disabled (set SCHEDULER_ENABLED=true to enable)');
    return;
  }
  if (timer) return;

  timer = setInterval(() => {
    try {
      const summary = runScheduledCycle();
      if (summary.savings_accruals || summary.loan_accruals || summary.defaulted_loans) {
        console.log('[scheduler] cycle', summary);
      }
    } catch (error) {
      console.error('[scheduler] cycle failed', error);
    }
  }, config.scheduler.intervalMs);
  timer.unref?.();
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
