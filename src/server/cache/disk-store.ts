import fs from 'fs';
import path from 'path';
import type { CandleInterval, OHLCVBar } from '../../shared/types/market';
import type { BacktestApiResponse } from '../../shared/types/backtest';
import type { RiskPosture } from '../../shared/types/strategy';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const OHLCV_DIR = path.join(DATA_DIR, 'ohlcv');
const PRERENDERED_DIR = path.join(DATA_DIR, 'prerendered');

// Ensure directories exist
function ensureDirs() {
  if (!fs.existsSync(OHLCV_DIR)) {
    fs.mkdirSync(OHLCV_DIR, { recursive: true });
  }
  if (!fs.existsSync(PRERENDERED_DIR)) {
    fs.mkdirSync(PRERENDERED_DIR, { recursive: true });
  }
}
ensureDirs();

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function getOhlcvCachePath(symbol: string, interval: CandleInterval): string {
  return path.join(OHLCV_DIR, `${sanitizeFilename(symbol)}_${interval}.json`);
}

export function getPrerenderedCachePath(
  symbol: string,
  strategyId: string,
  riskPosture: RiskPosture
): string {
  return path.join(
    PRERENDERED_DIR,
    `${sanitizeFilename(symbol)}_${sanitizeFilename(strategyId)}_${riskPosture}.json`
  );
}

export function isCacheFresh(filePath: string, maxAgeMs: number): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    const stats = fs.statSync(filePath);
    return Date.now() - stats.mtimeMs < maxAgeMs;
  } catch {
    return false;
  }
}

export function readCachedOHLCV(
  symbol: string,
  interval: CandleInterval
): readonly OHLCVBar[] | null {
  const filePath = getOhlcvCachePath(symbol, interval);
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as OHLCVBar[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeCachedOHLCV(
  symbol: string,
  interval: CandleInterval,
  bars: readonly OHLCVBar[]
): void {
  ensureDirs();
  const filePath = getOhlcvCachePath(symbol, interval);
  const tmpPath = `${filePath}.tmp.${Date.now()}`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(bars), 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    if (fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // ignore
      }
    }
    throw err;
  }
}

export function readPrerenderedBacktest(
  symbol: string,
  strategyId: string,
  riskPosture: RiskPosture
): BacktestApiResponse | null {
  const filePath = getPrerenderedCachePath(symbol, strategyId, riskPosture);
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as BacktestApiResponse;
    if (parsed && parsed.metrics && parsed.equityCurve) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function writePrerenderedBacktest(
  symbol: string,
  strategyId: string,
  riskPosture: RiskPosture,
  data: BacktestApiResponse
): void {
  ensureDirs();
  const filePath = getPrerenderedCachePath(symbol, strategyId, riskPosture);
  const tmpPath = `${filePath}.tmp.${Date.now()}`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(data), 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    if (fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // ignore
      }
    }
    throw err;
  }
}

export const CACHE_TTL = {
  DAILY_BARS_MS: 6 * 3600 * 1000, // 6 hours
  HOURLY_BARS_MS: 15 * 60 * 1000, // 15 minutes
  MINUTE_BARS_MS: 60 * 1000, // 60 seconds
  PRERENDERED_MS: 6 * 3600 * 1000, // 6 hours
};
