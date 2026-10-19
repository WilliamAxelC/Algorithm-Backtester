import type { CurrencyCode } from '../types/market';

/**
 * Formats a currency amount into tabular string format.
 * IDR: Rp 100.000.000 (or Rp 100 Jt / Rp 1,2 M if compact)
 * USD: $10,000.00 (or $10K / $1.2M if compact)
 */
export function formatCurrency(
  amount: number,
  currency: CurrencyCode,
  compact: boolean = false
): string {
  if (!Number.isFinite(amount)) return '-';

  if (compact) {
    if (currency === 'IDR') {
      const abs = Math.abs(amount);
      const sign = amount < 0 ? '-' : '';
      if (abs >= 1_000_000_000) {
        return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1)} M`;
      }
      if (abs >= 1_000_000) {
        return `${sign}Rp ${(abs / 1_000_000).toFixed(0)} Jt`;
      }
      if (abs >= 1_000) {
        return `${sign}Rp ${(abs / 1_000).toFixed(0)} Rb`;
      }
      return `${sign}Rp ${abs.toLocaleString('id-ID')}`;
    } else {
      const abs = Math.abs(amount);
      const sign = amount < 0 ? '-' : '';
      if (abs >= 1_000_000_000) {
        return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
      }
      if (abs >= 1_000_000) {
        return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
      }
      if (abs >= 1_000) {
        return `${sign}$${(abs / 1_000).toFixed(1)}K`;
      }
      return `${sign}$${abs.toFixed(2)}`;
    }
  }

  if (currency === 'IDR') {
    const formatted = Math.round(amount).toLocaleString('id-ID');
    return `Rp ${formatted}`;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats asset price with appropriate decimals.
 * IDR: whole rupiah if >= 100, else 2 decimals.
 * USD: 2 decimals if >= 1, 4 decimals if < 1.
 */
export function formatPrice(price: number, currency: CurrencyCode): string {
  if (!Number.isFinite(price)) return '-';

  if (currency === 'IDR') {
    if (price >= 100) {
      return `Rp ${Math.round(price).toLocaleString('id-ID')}`;
    }
    return `Rp ${price.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  if (Math.abs(price) < 1 && price !== 0) {
    return `$${price.toFixed(4)}`;
  }
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Formats a percentage with mandatory sign: +12.34% or -5.67%.
 */
export function formatSignedPct(pct: number): string {
  if (!Number.isFinite(pct)) return '0.00%';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

export const WIB_OFFSET_SECONDS = 7 * 3600; // +25,200 seconds (GMT+7)

export function toWibChartTime(utcSec: number): number {
  return utcSec + WIB_OFFSET_SECONDS;
}

export function fromWibChartTime(wibChartSec: number): number {
  return wibChartSec - WIB_OFFSET_SECONDS;
}

const wibDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const wibDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const wibClockFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jakarta',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/**
 * Formats a Unix timestamp (seconds) into ISO/tabular date string in Asia/Jakarta (WIB / GMT+7).
 */
export function formatUnixDate(unixSec: number, includeTime: boolean = false): string {
  if (!Number.isFinite(unixSec) || unixSec <= 0) return '-';
  const d = new Date(unixSec * 1000);

  if (!includeTime) {
    return wibDateFormatter.format(d);
  }

  const parts = wibDateTimeFormatter.formatToParts(d);
  let year = '';
  let month = '';
  let day = '';
  let hour = '';
  let minute = '';
  let second = '';
  for (const part of parts) {
    if (part.type === 'year') year = part.value;
    else if (part.type === 'month') month = part.value;
    else if (part.type === 'day') day = part.value;
    else if (part.type === 'hour') hour = part.value;
    else if (part.type === 'minute') minute = part.value;
    else if (part.type === 'second') second = part.value;
  }
  return `${year}-${month}-${day} ${hour}:${minute}:${second} WIB`;
}

/**
 * Formats a Unix timestamp (seconds) into live clock format: HH:mm:ss WIB (GMT+7).
 */
export function formatWibClock(unixSec: number): string {
  if (!Number.isFinite(unixSec) || unixSec <= 0) return '--:--:-- WIB';
  const d = new Date(unixSec * 1000);
  return `${wibClockFormatter.format(d)} WIB (GMT+7)`;
}

/**
 * Returns preset initial capital choices for a currency.
 */
export function capitalPresetsForCurrency(currency: CurrencyCode): readonly number[] {
  if (currency === 'IDR') {
    return [25_000_000, 50_000_000, 100_000_000, 250_000_000, 500_000_000, 1_000_000_000];
  }
  return [5_000, 10_000, 25_000, 50_000, 100_000, 250_000];
}
