import type { OHLCVBar } from '../types/market';

/**
 * Computes Simple Moving Average (SMA) of close prices over period.
 * For indices < period - 1, returns the progressive average of available bars.
 */
export function computeSMA(bars: readonly OHLCVBar[], period: number): number[] {
  const result: number[] = new Array<number>(bars.length);
  if (bars.length === 0) return result;

  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    if (!bar) continue;
    sum += bar.close;

    if (i >= period) {
      const dropBar = bars[i - period];
      if (dropBar) sum -= dropBar.close;
      result[i] = sum / period;
    } else {
      result[i] = sum / (i + 1);
    }
  }

  return result;
}

/**
 * Computes Exponential Moving Average (EMA) of close prices over period.
 */
export function computeEMA(bars: readonly OHLCVBar[], period: number): number[] {
  const result: number[] = new Array<number>(bars.length);
  if (bars.length === 0) return result;

  const k = 2 / (period + 1);
  let prevEma = bars[0]?.close ?? 0;
  result[0] = prevEma;

  for (let i = 1; i < bars.length; i++) {
    const bar = bars[i];
    if (!bar) continue;
    const currentEma = bar.close * k + prevEma * (1 - k);
    result[i] = currentEma;
    prevEma = currentEma;
  }

  return result;
}

/**
 * Computes Average True Range (ATR) using Wilder's smoothing.
 */
export function computeATR(bars: readonly OHLCVBar[], period: number): number[] {
  const result: number[] = new Array<number>(bars.length);
  if (bars.length === 0) return result;

  const firstBar = bars[0];
  if (!firstBar) return result;

  const trueRanges: number[] = new Array<number>(bars.length);
  trueRanges[0] = firstBar.high - firstBar.low;

  for (let i = 1; i < bars.length; i++) {
    const curr = bars[i];
    const prev = bars[i - 1];
    if (!curr || !prev) continue;

    const tr = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prev.close),
      Math.abs(curr.low - prev.close)
    );
    trueRanges[i] = tr;
  }

  let atrSum = 0;
  for (let i = 0; i < bars.length; i++) {
    const tr = trueRanges[i] ?? 0;
    if (i < period) {
      atrSum += tr;
      result[i] = atrSum / (i + 1);
    } else {
      const prevAtr = result[i - 1] ?? tr;
      result[i] = (prevAtr * (period - 1) + tr) / period;
    }
  }

  return result;
}

/**
 * Computes Relative Strength Index (RSI) using Wilder's smoothing.
 * Output range: 0..100.
 */
export function computeRSI(bars: readonly OHLCVBar[], period: number): number[] {
  const result: number[] = new Array<number>(bars.length);
  if (bars.length === 0) return result;

  result[0] = 50;
  if (bars.length === 1) return result;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i < bars.length; i++) {
    const curr = bars[i];
    const prev = bars[i - 1];
    if (!curr || !prev) continue;

    const change = curr.close - prev.close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    if (i <= period) {
      avgGain = (avgGain * (i - 1) + gain) / i;
      avgLoss = (avgLoss * (i - 1) + loss) / i;
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) {
      result[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      result[i] = 100 - 100 / (1 + rs);
    }
  }

  return result;
}

/**
 * Computes Spread Ratio: (current bar high - low) / 20-period SMA of (high - low).
 * Used by Wyckoff VSA for ultra-wide spread and absorption identification.
 */
export function computeSpreadRatio(bars: readonly OHLCVBar[], period: number = 20): number[] {
  const spreads = bars.map((b) => Math.max(b.high - b.low, 1e-6));
  const result: number[] = new Array<number>(bars.length);

  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    const sp = spreads[i] ?? 1e-6;
    sum += sp;

    if (i >= period) {
      const drop = spreads[i - period] ?? 1e-6;
      sum -= drop;
      const avg = sum / period;
      result[i] = avg > 0 ? sp / avg : 1.0;
    } else {
      const avg = sum / (i + 1);
      result[i] = avg > 0 ? sp / avg : 1.0;
    }
  }

  return result;
}

/**
 * Computes Volume Ratio: current bar volume / 20-period SMA of volume.
 * Identifies Climax (>2.0x), High (>1.5x), and Dry-Up (<0.6x) volume.
 */
export function computeVolumeRatio(bars: readonly OHLCVBar[], period: number = 20): number[] {
  const result: number[] = new Array<number>(bars.length);
  let sum = 0;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    if (!bar) continue;
    sum += bar.volume;

    if (i >= period) {
      const drop = bars[i - period];
      if (drop) sum -= drop.volume;
      const avg = sum / period;
      result[i] = avg > 0 ? bar.volume / avg : 1.0;
    } else {
      const avg = sum / (i + 1);
      result[i] = avg > 0 ? bar.volume / avg : 1.0;
    }
  }

  return result;
}

/**
 * Finds the highest high in bars[startIndex..endIndex] inclusive.
 */
export function highestHigh(
  bars: readonly OHLCVBar[],
  startIndex: number,
  endIndex: number
): number {
  if (bars.length === 0) return 0;
  const start = Math.max(0, startIndex);
  const end = Math.min(bars.length - 1, endIndex);
  if (start > end) return bars[end]?.high ?? 0;

  let maxVal = -Infinity;
  for (let i = start; i <= end; i++) {
    const bar = bars[i];
    if (bar && bar.high > maxVal) {
      maxVal = bar.high;
    }
  }
  return maxVal === -Infinity ? 0 : maxVal;
}

/**
 * Finds the lowest low in bars[startIndex..endIndex] inclusive.
 */
export function lowestLow(
  bars: readonly OHLCVBar[],
  startIndex: number,
  endIndex: number
): number {
  if (bars.length === 0) return 0;
  const start = Math.max(0, startIndex);
  const end = Math.min(bars.length - 1, endIndex);
  if (start > end) return bars[end]?.low ?? 0;

  let minVal = Infinity;
  for (let i = start; i <= end; i++) {
    const bar = bars[i];
    if (bar && bar.low < minVal) {
      minVal = bar.low;
    }
  }
  return minVal === Infinity ? 0 : minVal;
}
