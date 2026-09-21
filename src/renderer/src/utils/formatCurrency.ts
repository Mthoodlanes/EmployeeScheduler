/** Matches the original Electron dues tracker's `currency()` helper exactly — a leading `-` for negatives, no thousands separator (dues amounts never get that large). */
export function formatCurrency(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}
