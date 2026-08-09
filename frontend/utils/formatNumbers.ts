export function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatInputValue(value: string): string {
  const numericValue = value.replace(/[^0-9]/g, '');
  if (!numericValue) return '';
  return Number(numericValue).toLocaleString('en-US');
}

export function parseInputValue(formattedValue: string): string {
  return formattedValue.replace(/,/g, '');
}
