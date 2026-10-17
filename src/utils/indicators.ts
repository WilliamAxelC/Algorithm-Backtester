import type { OHLCVBar } from '../types/market';

export function computeSMA(values: readonly number[], period: number): number {
  if (period <= 0 || values.length === 0) {
    return 0;
  }
  const start = Math.max(0, values.length - period);
  const slice = values.slice(start);
  if (slice.length === 0) {
    return 0;
  }
  let sum = 0;
  for (const val of slice) {
    sum += val;
  }
  return sum / slice.length;
}

export function computeATR(bars: readonly OHLCVBar[], period: number): number {
  if (bars.length === 0 || period <= 0) {
    return 0;
  }
  if (bars.length === 1) {
    const first = bars[0];
    return first ? first.high - first.low : 0;
  }
  const startIdx = Math.max(1, bars.length - period);
  let trSum = 0;
  let count = 0;
  for (let i = startIdx; i < bars.length; i++) {
    const cur = bars[i];
    const prev = bars[i - 1];
    if (!cur || !prev) continue;
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close)
    );
    trSum += tr;
    count++;
  }
  return count > 0 ? trSum / count : 0;
}

export function computeSpreadRatio(bars: readonly OHLCVBar[], period: number): number {
  if (bars.length < 2 || period <= 0) {
    return 1.0;
  }
  const currentBar = bars[bars.length - 1];
  if (!currentBar) return 1.0;
  const currentSpread = Math.max(1e-8, currentBar.high - currentBar.low);
  const startIdx = Math.max(0, bars.length - 1 - period);
  let sumSpread = 0;
  let count = 0;
  for (let i = startIdx; i < bars.length - 1; i++) {
    const b = bars[i];
    if (!b) continue;
    sumSpread += Math.max(1e-8, b.high - b.low);
    count++;
  }
  const avgSpread = count > 0 ? sumSpread / count : currentSpread;
  return avgSpread > 0 ? currentSpread / avgSpread : 1.0;
}

export function computeVolumeRatio(bars: readonly OHLCVBar[], period: number): number {
  if (bars.length < 2 || period <= 0) {
    return 1.0;
  }
  const currentBar = bars[bars.length - 1];
  if (!currentBar) return 1.0;
  const startIdx = Math.max(0, bars.length - 1 - period);
  let sumVol = 0;
  let count = 0;
  for (let i = startIdx; i < bars.length - 1; i++) {
    const b = bars[i];
    if (!b) continue;
    sumVol += b.volume;
    count++;
  }
  const avgVol = count > 0 ? sumVol / count : currentBar.volume;
  return avgVol > 0 ? currentBar.volume / avgVol : 1.0;
}

export function highestHigh(
  bars: readonly OHLCVBar[],
  lookback: number,
  excludeLast: number = 0
): number {
  const endIdx = Math.max(0, bars.length - excludeLast);
  const startIdx = Math.max(0, endIdx - lookback);
  let maxHigh = -Infinity;
  for (let i = startIdx; i < endIdx; i++) {
    const b = bars[i];
    if (b && b.high > maxHigh) {
      maxHigh = b.high;
    }
  }
  return maxHigh === -Infinity ? 0 : maxHigh;
}

export function lowestLow(
  bars: readonly OHLCVBar[],
  lookback: number,
  excludeLast: number = 0
): number {
  const endIdx = Math.max(0, bars.length - excludeLast);
  const startIdx = Math.max(0, endIdx - lookback);
  let minLow = Infinity;
  for (let i = startIdx; i < endIdx; i++) {
    const b = bars[i];
    if (b && b.low < minLow) {
      minLow = b.low;
    }
  }
  return minLow === Infinity ? 0 : minLow;
}
