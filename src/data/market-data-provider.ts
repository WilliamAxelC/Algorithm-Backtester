import type {
  MarketDataset,
  OHLCVBar,
  TimeRangeFilter,
} from '../types/market';
import { getAssetBasePrice, getAssetBySymbol } from './asset-catalog';

/**
 * Derives a 32-bit FNV-1a deterministic hash from an asset symbol string.
 */
function hashSymbol(symbol: string): number {
  let hash = 2166136261;
  for (let i = 0; i < symbol.length; i++) {
    hash ^= symbol.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Rounds prices according to market currency conventions:
 * - IDR: nearest integer Rp 1
 * - USD: 2 decimal places
 */
function roundPrice(val: number, isIdr: boolean): number {
  if (isIdr) {
    return Math.max(1, Math.round(val));
  }
  return Math.max(0.01, Math.round(val * 100) / 100);
}

/**
 * Generates a deterministic 365 daily-bar historical dataset ending at 2026-10-15T00:00:00Z (1792022400).
 * Embeds two complete Wyckoff Accumulation-to-Markup cycles:
 * - Cycle 1: Bars 0–180
 * - Cycle 2: Bars 181–364
 */
export function getFullDatasetForAsset(symbol: string): MarketDataset {
  const asset = getAssetBySymbol(symbol);
  const basePrice = getAssetBasePrice(asset.symbol);
  const isIdr = asset.currency === 'IDR';
  const variant = asset.wyckoffVariant;
  const seed = hashSymbol(asset.symbol);
  const symbolNoise = ((seed % 1000) / 1000) * 0.003;

  const baseVol =
    asset.assetClass === 'CRYPTO'
      ? 120000
      : asset.assetClass === 'IDX_LQ45'
      ? 15000000
      : 2500000;

  const totalBars = 365;
  const endTime = 1792022400; // 2026-10-15T00:00:00Z
  const step = 86400; // 1 day
  const startTime = endTime - (totalBars - 1) * step;

  const bars: OHLCVBar[] = [];

  let prevClose = basePrice * 1.22;

  for (let i = 0; i < totalBars; i++) {
    const time = startTime + i * step;
    let rawOpen: number;
    let rawClose: number;
    let rawHigh: number;
    let rawLow: number;
    let rawVolume: number;

    if (i <= 180) {
      // ==========================================
      // CYCLE 1: Bars 0–180
      // ==========================================
      const p1 = basePrice;
      const v = baseVol;

      if (i <= 24) {
        // Prior Downtrend (Bars 0–24)
        const frac = i / 24;
        const targetClose = p1 * (1.21 - frac * (1.21 - 0.94) + Math.sin(i * 1.3) * 0.005 + symbolNoise);
        rawOpen = prevClose;
        rawClose = targetClose;
        const spread = 0.022 * rawClose;
        rawHigh = Math.max(rawOpen, rawClose) + 0.45 * spread;
        rawLow = Math.min(rawOpen, rawClose) - 0.55 * spread;
        rawVolume = v * (0.95 + 0.08 * Math.sin(i * 0.7));
      } else if (i === 25) {
        // Preliminary Support (PS)
        // High volume drop establishing temporary support
        rawOpen = prevClose;
        rawClose = p1 * 0.905;
        rawLow = p1 * 0.88;
        rawHigh = p1 * 0.93;
        rawVolume = v * 1.7;
      } else if (i <= 29) {
        // Post-PS continuation down to Selling Climax
        const frac = (i - 25) / 5;
        rawOpen = prevClose;
        rawClose = p1 * (0.905 - frac * (0.905 - 0.85));
        const spread = 0.02 * rawClose;
        rawHigh = Math.max(rawOpen, rawClose) + 0.3 * spread;
        rawLow = Math.min(rawOpen, rawClose) - 0.7 * spread;
        rawVolume = v * (1.05 + 0.05 * frac);
      } else if (i === 30) {
        // Selling Climax (SC)
        // Climactic capitulation bar with 2.4x volume and wide spread setting TR support
        rawOpen = p1 * 0.85;
        rawHigh = p1 * 0.86;
        rawLow = p1 * 0.78; // Sets TR support
        rawClose = p1 * 0.825; // closeOffLowPct = (0.825 - 0.78) / 0.08 = 0.5625 >= 0.25
        rawVolume = v * 2.4;
      } else if (i <= 41) {
        // Automatic Rally (AR) advance
        const frac = (i - 30) / 12;
        rawOpen = prevClose;
        rawClose = p1 * (0.825 + frac * (1.045 - 0.825));
        const spread = 0.024 * rawClose;
        rawHigh = Math.max(rawOpen, rawClose) + 0.45 * spread;
        rawLow = Math.min(rawOpen, rawClose) - 0.55 * spread;
        rawVolume = v * (1.1 + 0.25 * frac);
      } else if (i === 42) {
        // AR Peak setting TR resistance
        rawOpen = prevClose;
        rawHigh = p1 * 1.05; // Sets TR resistance
        rawLow = p1 * 1.025;
        rawClose = p1 * 1.045;
        rawVolume = v * 1.45;
      } else if (i === 43) {
        // AR confirmation pullback (close < prior close)
        rawOpen = prevClose;
        rawHigh = p1 * 1.046;
        rawLow = p1 * 1.018;
        rawClose = p1 * 1.022;
        rawVolume = v * 1.05;
      } else if (i <= 52) {
        // Secondary Test (ST) decline towards support
        const frac = (i - 43) / 10;
        rawOpen = prevClose;
        rawClose = p1 * (1.022 - frac * (1.022 - 0.796));
        const spread = 0.016 * rawClose;
        rawHigh = Math.max(rawOpen, rawClose) + 0.4 * spread;
        rawLow = Math.min(rawOpen, rawClose) - 0.6 * spread;
        rawVolume = v * (0.95 - 0.3 * frac);
      } else if (i === 53) {
        // Secondary Test (ST) bottom on narrow spread and low volume
        rawOpen = prevClose;
        rawHigh = p1 * 0.803;
        rawLow = p1 * 0.792; // Near support 0.78
        rawClose = p1 * 0.796;
        rawVolume = v * 0.6; // Low volume confirms absorption
      } else if (i <= 100) {
        // Phase B — Building a Cause (Bars 54–100)
        if (i === 75) {
          // Upthrust (UT) poking above TR resistance
          rawOpen = p1 * 1.04;
          rawHigh = p1 * 1.065; // > resistance 1.05
          rawLow = p1 * 1.03;
          rawClose = p1 * 1.051;
          rawVolume = v * 1.25;
        } else {
          const fracB = (i - 54) / 46;
          const osc = Math.sin(fracB * 3 * Math.PI + symbolNoise * 100);
          rawOpen = prevClose;
          rawClose = p1 * (0.915 + 0.08 * osc);
          // Absorption: volume and spread diminish progressively
          const dampening = Math.max(0.4, 1.0 - fracB * 0.55);
          const spread = 0.018 * dampening * rawClose;
          rawHigh = Math.max(rawOpen, rawClose) + 0.45 * spread;
          rawLow = Math.min(rawOpen, rawClose) - 0.55 * spread;
          rawVolume = v * (0.85 * dampening);
          if (i === 100) {
            // Ensure Bar 100 is in the lower half of TR with dried volume to trigger Phase C
            rawClose = p1 * 0.845;
            rawLow = p1 * 0.84;
            rawHigh = p1 * 0.855;
            rawVolume = v * 0.4;
          }
        }
      } else if (i <= 109) {
        // Quiet preparation before Phase C test
        const fracC = (i - 100) / 9;
        rawOpen = prevClose;
        rawClose = p1 * (0.845 - fracC * 0.015);
        const spread = 0.013 * rawClose;
        rawHigh = Math.max(rawOpen, rawClose) + 0.4 * spread;
        rawLow = Math.min(rawOpen, rawClose) - 0.6 * spread;
        rawVolume = v * 0.45;
      } else if (i === 110) {
        // Phase C Decisive Test
        if (variant === 'SCHEMATIC_1_SPRING') {
          // Bear-trap Spring dipping below TR support (0.78) and closing back inside
          rawOpen = p1 * 0.785;
          rawHigh = p1 * 0.792;
          rawLow = p1 * 0.765; // Below 0.78 support
          rawClose = p1 * 0.783; // Closes back inside TR
          rawVolume = v * 0.75;
        } else {
          // Schematic #2 Higher-Low LPS test held well above TR support
          rawOpen = p1 * 0.832;
          rawHigh = p1 * 0.838;
          rawLow = p1 * 0.824; // Above 0.78 support
          rawClose = p1 * 0.83;
          rawVolume = v * 0.45; // Dry volume
        }
      } else if (i === 111) {
        // Bullish Demand Confirmation Bar
        if (variant === 'SCHEMATIC_1_SPRING') {
          rawOpen = p1 * 0.783;
          rawLow = p1 * 0.78;
          rawHigh = p1 * 0.838;
          rawClose = p1 * 0.832;
          rawVolume = v * 1.35;
        } else {
          rawOpen = p1 * 0.83;
          rawLow = p1 * 0.828;
          rawHigh = p1 * 0.875;
          rawClose = p1 * 0.87; // Closes above Bar 110 high
          rawVolume = v * 1.45;
        }
      } else if (i <= 115) {
        // Post-Phase C rise
        const frac = (i - 111) / 4;
        rawOpen = prevClose;
        rawClose = p1 * (0.87 + frac * (0.92 - 0.87));
        const spread = 0.018 * rawClose;
        rawHigh = Math.max(rawOpen, rawClose) + 0.4 * spread;
        rawLow = Math.min(rawOpen, rawClose) - 0.6 * spread;
        rawVolume = v * (1.1 + 0.15 * frac);
      } else if (i <= 124) {
        // Phase D Advance toward resistance
        const frac = (i - 115) / 10;
        rawOpen = prevClose;
        rawClose = p1 * (0.92 + frac * (1.025 - 0.92));
        const spread = 0.022 * rawClose;
        rawHigh = Math.max(rawOpen, rawClose) + 0.45 * spread;
        rawLow = Math.min(rawOpen, rawClose) - 0.55 * spread;
        rawVolume = v * (1.2 + 0.3 * frac);
      } else if (i === 125) {
        // Sign of Strength (SOS) on 2.1x volume reaching above resistance
        rawOpen = p1 * 1.025;
        rawLow = p1 * 1.02;
        rawHigh = p1 * 1.072; // Above resistance 1.05
        rawClose = p1 * 1.065;
        rawVolume = v * 2.1;
      } else if (i <= 134) {
        // Phase D Pullback to LPS on drying volume
        const frac = (i - 125) / 10;
        rawOpen = prevClose;
        rawClose = p1 * (1.065 - frac * (1.065 - 1.004));
        const spread = 0.015 * rawClose;
        rawHigh = Math.max(rawOpen, rawClose) + 0.4 * spread;
        rawLow = Math.min(rawOpen, rawClose) - 0.6 * spread;
        rawVolume = v * (0.85 - 0.35 * frac);
      } else if (i === 135) {
        // LPS Candidate low
        rawOpen = p1 * 1.006;
        rawHigh = p1 * 1.012;
        rawLow = p1 * 0.998;
        rawClose = p1 * 1.004;
        rawVolume = v * 0.48;
      } else if (i === 136) {
        // LPS Continuation Demand Candle
        rawOpen = p1 * 1.004;
        rawLow = p1 * 1.002;
        rawHigh = p1 * 1.045;
        rawClose = p1 * 1.04;
        rawVolume = v * 1.4;
      } else if (i <= 145) {
        // Consolidation near resistance
        const frac = (i - 136) / 9;
        rawOpen = prevClose;
        rawClose = p1 * (1.04 + frac * 0.015);
        const spread = 0.016 * rawClose;
        rawHigh = Math.max(rawOpen, rawClose) + 0.4 * spread;
        rawLow = Math.min(rawOpen, rawClose) - 0.6 * spread;
        rawVolume = v * (1.0 + 0.1 * frac);
      } else if (i === 146) {
        // Phase E Breakout outside TR
        rawOpen = p1 * 1.055;
        rawLow = p1 * 1.05;
        rawHigh = p1 * 1.1;
        rawClose = p1 * 1.095;
        rawVolume = v * 1.95;
      } else if (i <= 152) {
        // Back-Up (BU) to broken resistance
        const frac = (i - 146) / 6;
        rawOpen = prevClose;
        rawClose = p1 * (1.095 - frac * 0.025);
        const spread = 0.015 * rawClose;
        rawHigh = Math.max(rawOpen, rawClose) + 0.4 * spread;
        rawLow = Math.min(rawOpen, rawClose) - 0.6 * spread;
        rawVolume = v * (1.05 - 0.15 * frac);
      } else {
        // Phase E Markup (Bars 153–180)
        const frac = (i - 152) / 28;
        const targetClose = p1 * (1.07 + frac * (1.45 - 1.07) + Math.sin(i * 0.8) * 0.006 + symbolNoise);
        rawOpen = prevClose;
        rawClose = targetClose;
        const spread = 0.024 * rawClose;
        rawHigh = Math.max(rawOpen, rawClose) + 0.45 * spread;
        rawLow = Math.min(rawOpen, rawClose) - 0.55 * spread;
        rawVolume = v * (1.15 + 0.2 * Math.sin(i * 0.5));
      }
    } else {
      // ==========================================
      // CYCLE 2: Bars 181–364
      // ==========================================
      const p2 = basePrice * 1.38;
      const v = baseVol;

      if (i <= 205) {
        // Downtrend / Healthy Correction (Bars 181–205)
        const frac = (i - 181) / 24;
        const targetClose = p2 * (1.05 - frac * (1.05 - 0.94) + Math.sin(i * 1.2) * 0.005 + symbolNoise);
        rawOpen = prevClose;
        rawClose = targetClose;
        const spread = 0.022 * rawClose;
        rawHigh = Math.max(rawOpen, rawClose) + 0.45 * spread;
        rawLow = Math.min(rawOpen, rawClose) - 0.55 * spread;
        rawVolume = v * (0.95 + 0.08 * Math.sin(i * 0.7));
      } else if (i === 206) {
        // Preliminary Support (PS) in Cycle 2
        rawOpen = prevClose;
        rawClose = p2 * 0.905;
        rawLow = p2 * 0.88;
        rawHigh = p2 * 0.93;
        rawVolume = v * 1.7;
      } else if (i <= 211) {
        // Drift down to SC
        const frac = (i - 206) / 5;
        rawOpen = prevClose;
        rawClose = p2 * (0.905 - frac * (0.905 - 0.85));
        const spread = 0.02 * rawClose;
        rawHigh = Math.max(rawOpen, rawClose) + 0.3 * spread;
        rawLow = Math.min(rawOpen, rawClose) - 0.7 * spread;
        rawVolume = v * (1.05 + 0.05 * frac);
      } else if (i === 212) {
        // Selling Climax (SC) in Cycle 2
        rawOpen = p2 * 0.85;
        rawHigh = p2 * 0.86;
        rawLow = p2 * 0.78; // Sets TR support for Cycle 2
        rawClose = p2 * 0.825;
        rawVolume = v * 2.4;
      } else if (i <= 224) {
        // Automatic Rally (AR) advance
        const frac = (i - 212) / 12;
        rawOpen = prevClose;
        rawClose = p2 * (0.825 + frac * (1.045 - 0.825));
        const spread = 0.024 * rawClose;
        rawHigh = Math.max(rawOpen, rawClose) + 0.45 * spread;
        rawLow = Math.min(rawOpen, rawClose) - 0.55 * spread;
        rawVolume = v * (1.1 + 0.25 * frac);
      } else if (i === 225) {
        // AR Peak setting TR resistance for Cycle 2
        rawOpen = prevClose;
        rawHigh = p2 * 1.05;
        rawLow = p2 * 1.025;
        rawClose = p2 * 1.045;
        rawVolume = v * 1.45;
      } else if (i === 226) {
        // AR confirmation pullback
        rawOpen = prevClose;
        rawHigh = p2 * 1.046;
        rawLow = p2 * 1.018;
        rawClose = p2 * 1.022;
        rawVolume = v * 1.05;
      } else if (i <= 235) {
        // ST decline towards support
        const frac = (i - 226) / 10;
        rawOpen = prevClose;
        rawClose = p2 * (1.022 - frac * (1.022 - 0.796));
        const spread = 0.016 * rawClose;
        rawHigh = Math.max(rawOpen, rawClose) + 0.4 * spread;
        rawLow = Math.min(rawOpen, rawClose) - 0.6 * spread;
        rawVolume = v * (0.95 - 0.3 * frac);
      } else if (i === 236) {
        // ST bottom
        rawOpen = prevClose;
        rawHigh = p2 * 0.803;
        rawLow = p2 * 0.792;
        rawClose = p2 * 0.796;
        rawVolume = v * 0.6;
      } else if (i <= 285) {
        // Phase B Consolidation (Bars 237–285)
        if (i === 260) {
          // Upthrust (UT)
          rawOpen = p2 * 1.04;
          rawHigh = p2 * 1.065;
          rawLow = p2 * 1.03;
          rawClose = p2 * 1.051;
          rawVolume = v * 1.25;
        } else {
          const fracB = (i - 237) / 48;
          const osc = Math.sin(fracB * 3 * Math.PI + symbolNoise * 100);
          rawOpen = prevClose;
          rawClose = p2 * (0.915 + 0.08 * osc);
          const dampening = Math.max(0.4, 1.0 - fracB * 0.55);
          const spread = 0.018 * dampening * rawClose;
          rawHigh = Math.max(rawOpen, rawClose) + 0.45 * spread;
          rawLow = Math.min(rawOpen, rawClose) - 0.55 * spread;
          rawVolume = v * (0.85 * dampening);
          if (i === 285) {
            rawClose = p2 * 0.845;
            rawLow = p2 * 0.84;
            rawHigh = p2 * 0.855;
            rawVolume = v * 0.4;
          }
        }
      } else if (i <= 294) {
        // Quiet preparation before Phase C test
        const fracC = (i - 285) / 9;
        rawOpen = prevClose;
        rawClose = p2 * (0.845 - fracC * 0.015);
        const spread = 0.013 * rawClose;
        rawHigh = Math.max(rawOpen, rawClose) + 0.4 * spread;
        rawLow = Math.min(rawOpen, rawClose) - 0.6 * spread;
        rawVolume = v * 0.45;
      } else if (i === 295) {
        // Phase C Decisive Test
        if (variant === 'SCHEMATIC_1_SPRING') {
          rawOpen = p2 * 0.785;
          rawHigh = p2 * 0.792;
          rawLow = p2 * 0.765;
          rawClose = p2 * 0.783;
          rawVolume = v * 0.75;
        } else {
          rawOpen = p2 * 0.832;
          rawHigh = p2 * 0.838;
          rawLow = p2 * 0.824;
          rawClose = p2 * 0.83;
          rawVolume = v * 0.45;
        }
      } else if (i === 296) {
        // Bullish Demand Confirmation Bar
        if (variant === 'SCHEMATIC_1_SPRING') {
          rawOpen = p2 * 0.783;
          rawLow = p2 * 0.78;
          rawHigh = p2 * 0.838;
          rawClose = p2 * 0.832;
          rawVolume = v * 1.35;
        } else {
          rawOpen = p2 * 0.83;
          rawLow = p2 * 0.828;
          rawHigh = p2 * 0.875;
          rawClose = p2 * 0.87;
          rawVolume = v * 1.45;
        }
      } else if (i <= 300) {
        // Post-Phase C rise
        const frac = (i - 296) / 4;
        rawOpen = prevClose;
        rawClose = p2 * (0.87 + frac * (0.92 - 0.87));
        const spread = 0.018 * rawClose;
        rawHigh = Math.max(rawOpen, rawClose) + 0.4 * spread;
        rawLow = Math.min(rawOpen, rawClose) - 0.6 * spread;
        rawVolume = v * (1.1 + 0.15 * frac);
      } else if (i <= 309) {
        // Phase D Advance toward resistance
        const frac = (i - 300) / 10;
        rawOpen = prevClose;
        rawClose = p2 * (0.92 + frac * (1.025 - 0.92));
        const spread = 0.022 * rawClose;
        rawHigh = Math.max(rawOpen, rawClose) + 0.45 * spread;
        rawLow = Math.min(rawOpen, rawClose) - 0.55 * spread;
        rawVolume = v * (1.2 + 0.3 * frac);
      } else if (i === 310) {
        // Sign of Strength (SOS) on 2.1x volume
        rawOpen = p2 * 1.025;
        rawLow = p2 * 1.02;
        rawHigh = p2 * 1.072;
        rawClose = p2 * 1.065;
        rawVolume = v * 2.1;
      } else if (i <= 319) {
        // Phase D Pullback to LPS
        const frac = (i - 310) / 10;
        rawOpen = prevClose;
        rawClose = p2 * (1.065 - frac * (1.065 - 1.004));
        const spread = 0.015 * rawClose;
        rawHigh = Math.max(rawOpen, rawClose) + 0.4 * spread;
        rawLow = Math.min(rawOpen, rawClose) - 0.6 * spread;
        rawVolume = v * (0.85 - 0.35 * frac);
      } else if (i === 320) {
        // LPS Candidate low
        rawOpen = p2 * 1.006;
        rawHigh = p2 * 1.012;
        rawLow = p2 * 0.998;
        rawClose = p2 * 1.004;
        rawVolume = v * 0.48;
      } else if (i === 321) {
        // LPS Continuation Demand Candle
        rawOpen = p2 * 1.004;
        rawLow = p2 * 1.002;
        rawHigh = p2 * 1.045;
        rawClose = p2 * 1.04;
        rawVolume = v * 1.4;
      } else if (i <= 330) {
        // Consolidation near resistance
        const frac = (i - 321) / 9;
        rawOpen = prevClose;
        rawClose = p2 * (1.04 + frac * 0.015);
        const spread = 0.016 * rawClose;
        rawHigh = Math.max(rawOpen, rawClose) + 0.4 * spread;
        rawLow = Math.min(rawOpen, rawClose) - 0.6 * spread;
        rawVolume = v * (1.0 + 0.1 * frac);
      } else if (i === 331) {
        // Phase E Breakout outside TR
        rawOpen = p2 * 1.055;
        rawLow = p2 * 1.05;
        rawHigh = p2 * 1.1;
        rawClose = p2 * 1.095;
        rawVolume = v * 1.95;
      } else if (i <= 336) {
        // BU Back-Up
        const frac = (i - 331) / 5;
        rawOpen = prevClose;
        rawClose = p2 * (1.095 - frac * 0.025);
        const spread = 0.015 * rawClose;
        rawHigh = Math.max(rawOpen, rawClose) + 0.4 * spread;
        rawLow = Math.min(rawOpen, rawClose) - 0.6 * spread;
        rawVolume = v * (1.05 - 0.15 * frac);
      } else {
        // Phase E Markup (Bars 337–364)
        const frac = (i - 336) / 28;
        const targetClose = p2 * (1.07 + frac * (1.35 - 1.07) + Math.sin(i * 0.8) * 0.006 + symbolNoise);
        rawOpen = prevClose;
        rawClose = targetClose;
        const spread = 0.024 * rawClose;
        rawHigh = Math.max(rawOpen, rawClose) + 0.45 * spread;
        rawLow = Math.min(rawOpen, rawClose) - 0.55 * spread;
        rawVolume = v * (1.15 + 0.2 * Math.sin(i * 0.5));
      }
    }

    const open = roundPrice(rawOpen, isIdr);
    const close = roundPrice(rawClose, isIdr);
    let high = roundPrice(Math.max(rawHigh, open, close), isIdr);
    let low = roundPrice(Math.min(rawLow, open, close), isIdr);

    if (high < Math.max(open, close)) {
      high = Math.max(open, close);
    }
    if (low > Math.min(open, close)) {
      low = Math.min(open, close);
    }
    if (high === low) {
      high = isIdr ? low + 1 : roundPrice(low + 0.01, isIdr);
    }

    const volume = Math.max(100, Math.round(rawVolume));

    bars.push({
      time,
      open,
      high,
      low,
      close,
      volume,
    });

    prevClose = close;
  }

  return {
    asset,
    timeframe: '1D',
    bars,
    id: asset.symbol,
    symbol: asset.symbol,
    description: asset.name,
  };
}

/**
 * Slices a MarketDataset according to the specified TimeRangeFilter.
 * Guarantees at least 15 bars (falling back to trailing 30 bars if narrower).
 */
export function filterDatasetByTimeRange(
  dataset: MarketDataset,
  filter: TimeRangeFilter
): MarketDataset {
  const bars = dataset.bars;
  if (bars.length === 0) {
    return dataset;
  }

  let filtered: readonly OHLCVBar[];

  switch (filter.preset) {
    case '1M':
      filtered = bars.slice(-30);
      break;
    case '3M':
      filtered = bars.slice(-90);
      break;
    case '6M':
      filtered = bars.slice(-180);
      break;
    case 'YTD': {
      const ytdStart = 1767225600; // 2026-01-01T00:00:00Z
      filtered = bars.filter((b) => b.time >= ytdStart);
      break;
    }
    case '1Y':
    case 'ALL':
      filtered = bars.slice();
      break;
    case 'CUSTOM': {
      const start = filter.startTime ?? -Infinity;
      const end = filter.endTime ?? Infinity;
      filtered = bars.filter((b) => b.time >= start && b.time <= end);
      break;
    }
    default:
      filtered = bars.slice();
      break;
  }

  if (filtered.length < 15) {
    const fallbackCount = Math.min(30, bars.length);
    filtered = bars.slice(-fallbackCount);
  }

  return {
    ...dataset,
    bars: filtered,
  };
}
