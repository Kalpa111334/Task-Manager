export function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-LK');
}

export function parseCurrencyInput(value: string): number {
  return parseFloat(value.replace(/[^0-9.-]+/g, '')) || 0;
} 