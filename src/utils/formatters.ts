import type { CurrencyCode } from '../types/market';

/**
 * Formats a currency amount according to currency-specific market conventions.
 * - 'IDR': 'Rp ' prefix and dot thousand separators (e.g., Rp 100.000.000, or Rp 104,5 Jt when compact === true && Math.abs(amount) >= 1_000_000)
 * - 'USD': '$' prefix (e.g., $10,450.25, or $10.5K when compact === true && Math.abs(amount) >= 10_000)
 */
export function formatCurrency(
  amount: number,
  currency: CurrencyCode,
  compact: boolean = false
): string {
  const isNegative = amount < 0;
  const abs = Math.abs(amount);
  const sign = isNegative ? '-' : '';

  if (currency === 'IDR') {
    if (compact && abs >= 1_000_000_000) {
      const billions = abs / 1_000_000_000;
      const rounded = Math.round(billions * 10) / 10;
      const numStr = (rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)).replace('.', ',');
      return `${sign}Rp ${numStr} Miliar`;
    }
    if (compact && abs >= 1_000_000) {
      const millions = abs / 1_000_000;
      const rounded = Math.round(millions * 10) / 10;
      const numStr = (rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)).replace('.', ',');
      return `${sign}Rp ${numStr} Jt`;
    }
    const intStr = Math.round(abs).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${sign}Rp ${intStr}`;
  }

  // USD
  if (compact && abs >= 1_000_000_000) {
    const billions = abs / 1_000_000_000;
    const rounded = Math.round(billions * 10) / 10;
    const numStr = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
    return `${sign}$${numStr}B`;
  }
  if (compact && abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    const rounded = Math.round(millions * 10) / 10;
    const numStr = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
    return `${sign}$${numStr}M`;
  }
  if (compact && abs >= 10_000) {
    const thousands = abs / 1_000;
    const rounded = Math.round(thousands * 10) / 10;
    const numStr = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
    return `${sign}$${numStr}K`;
  }

  const fixed = abs.toFixed(2);
  const parts = fixed.split('.');
  const intPart = parts[0] ?? '0';
  const decPart = parts[1] ?? '00';
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}$${withCommas}.${decPart}`;
}

/**
 * Formats a single unit price.
 * - 'IDR': 'Rp ' + integer with dot separators (e.g., Rp 9.450)
 * - 'USD': '$' + 2 decimal places (e.g., $6.45 or $68,420.00)
 */
export function formatPrice(price: number, currency: CurrencyCode): string {
  const isNegative = price < 0;
  const abs = Math.abs(price);
  const sign = isNegative ? '-' : '';

  if (currency === 'IDR') {
    const intStr = Math.round(abs).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${sign}Rp ${intStr}`;
  }

  const fixed = abs.toFixed(2);
  const parts = fixed.split('.');
  const intPart = parts[0] ?? '0';
  const decPart = parts[1] ?? '00';
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}$${withCommas}.${decPart}`;
}

/**
 * Formats a signed percentage (e.g., +14.25% or -3.40%).
 */
export function formatSignedPct(pct: number): string {
  if (Number.isNaN(pct)) {
    return '0.00%';
  }
  const formatted = Math.abs(pct).toFixed(2);
  if (pct > 0) {
    return `+${formatted}%`;
  }
  if (pct < 0 && formatted !== '0.00') {
    return `-${formatted}%`;
  }
  return `+0.00%`;
}

/**
 * Formats a Unix timestamp in seconds (UTC) to 'YYYY-MM-DD' or 'YYYY-MM-DD HH:mm'.
 */
export function formatUnixDate(unixSec: number, includeTime: boolean = false): string {
  const date = new Date(unixSec * 1000);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const datePart = `${yyyy}-${mm}-${dd}`;

  if (includeTime) {
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const min = String(date.getUTCMinutes()).padStart(2, '0');
    return `${datePart} ${hh}:${min}`;
  }

  return datePart;
}

export interface CapitalPreset {
  readonly label: string;
  readonly value: number;
}

/**
 * Returns currency-specific initial capital presets.
 * - 'IDR': Rp 25 Jt, Rp 100 Jt, Rp 500 Jt, Rp 1 Miliar
 * - 'USD': $2,500, $10,000, $50,000, $100,000
 */
export function capitalPresetsForCurrency(
  currency: CurrencyCode
): readonly { readonly label: string; readonly value: number }[] {
  if (currency === 'IDR') {
    return [
      { label: 'Rp 25 Jt', value: 25_000_000 },
      { label: 'Rp 100 Jt', value: 100_000_000 },
      { label: 'Rp 500 Jt', value: 500_000_000 },
      { label: 'Rp 1 Miliar', value: 1_000_000_000 },
    ] as const;
  }

  return [
    { label: '$2,500', value: 2_500 },
    { label: '$10,000', value: 10_000 },
    { label: '$50,000', value: 50_000 },
    { label: '$100,000', value: 100_000 },
  ] as const;
}
