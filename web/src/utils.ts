export function txEmoji(type: string): string {
  const map: Record<string, string> = {
    checkin_reward: '✅',
    bounty_reward: '🎯',
    streak_bonus: '🔥',
    badge_reward: '🏅',
    promotion_bonus: '🎉',
    proposal_budget: '📈',
    proposal_return: '💹',
    asset_purchase: '🛍️',
    asset_sale: '💰',
    savings_deposit: '🏦',
    savings_withdraw: '💸',
    interest: '🌱',
    loan_disbursement: '💳',
    loan_repayment: '✅',
    loan_interest: '📉',
    adjustment: '⚙️',
  };
  return map[type] ?? '🔹';
}

export function money(n: number): string {
  return Number(n ?? 0).toFixed(2);
}

export function percent(current: number, need: number): number {
  if (!need) return 0;
  return Math.min(100, Math.round((current / need) * 100));
}

export function shortDate(iso: string | null): string {
  if (!iso) return '-';
  return iso.replace('T', ' ').slice(0, 16);
}
