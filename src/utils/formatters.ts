export const formatInr = (value: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

export const amountToWords = (value: number): string =>
  value > 0 ? `Rupees ${value.toLocaleString('en-IN')} only` : '';

export const todayIso = (): string => new Date().toISOString().slice(0, 10);
