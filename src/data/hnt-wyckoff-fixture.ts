import type { MarketDataset, OHLCVBar } from '../types/market';

export type WyckoffSchematicVariant = 'SCHEMATIC_2_LPS' | 'SCHEMATIC_1_SPRING';

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Builds a deterministic 240-bar 1H dataset for HNTUSDTPERP modeling Wyckoff Accumulation.
 *
 * Supports two variants:
 * - 'SCHEMATIC_2_LPS': Wyckoff Accumulation Schematic #2 (Higher-Low test in Phase C without a Spring below TR support).
 * - 'SCHEMATIC_1_SPRING': Classic Wyckoff Accumulation Schematic #1 (Bear-trap Spring below TR support in Phase C).
 *
 * No Math.random() is used; all bars and indicators are 100% deterministic.
 */
export function buildHntWyckoffDataset(variant: WyckoffSchematicVariant): MarketDataset {
  const startTime = 1704067200; // 2024-01-01T00:00:00Z
  const stepTime = 3600; // 1 hour per bar
  const totalBars = 240;

  const rawBars: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[] = [];

  for (let i = 0; i < totalBars; i++) {
    rawBars.push({
      time: startTime + i * stepTime,
      open: 0,
      high: 0,
      low: 0,
      close: 0,
      volume: 0,
    });
  }

  // 1. Bars 0–34 (Prior Downtrend):
  // Price trends down from $8.40 to $5.60 with baseline volume ~120,000 and baseline spread ~$0.14.
  for (let i = 0; i <= 25; i++) {
    const targetClose = round2(8.40 - (i / 25) * (8.40 - 6.45));
    const prevBar = i > 0 ? rawBars[i - 1] : undefined;
    const open = prevBar ? prevBar.close : 8.42;
    const spread = 0.14;
    const high = round2(Math.max(open, targetClose) + 0.04);
    const low = round2(Math.min(open, targetClose) - (spread - (high - Math.max(open, targetClose))));
    const volume = 118000 + ((i * 137) % 8000);
    rawBars[i] = {
      time: startTime + i * stepTime,
      open,
      high,
      low,
      close: targetClose,
      volume,
    };
  }

  // Bar 26 (Preliminary Support PS):
  // High-volume wide-spread drop (low: 6.10, close: 6.18, volume: 260,000).
  const bar25 = rawBars[25];
  rawBars[26] = {
    time: startTime + 26 * stepTime,
    open: bar25 ? bar25.close : 6.45,
    high: 6.48,
    low: 6.10,
    close: 6.18,
    volume: 260000,
  };

  // Bar 27: minor relief bounce after PS
  rawBars[27] = {
    time: startTime + 27 * stepTime,
    open: 6.18,
    high: 6.28,
    low: 6.15,
    close: 6.24,
    volume: 135000,
  };

  // Bars 28–34: continuing down from 6.24 to ~5.58
  for (let i = 28; i <= 34; i++) {
    const fraction = (i - 27) / (34 - 27);
    const targetClose = round2(6.24 - fraction * (6.24 - 5.58));
    const prevBar = rawBars[i - 1];
    const open = prevBar ? prevBar.close : 6.0;
    const spread = 0.14;
    const high = round2(Math.max(open, targetClose) + 0.04);
    const low = round2(Math.min(open, targetClose) - (spread - (high - Math.max(open, targetClose))));
    const volume = 120000 + ((i * 313) % 10000);
    rawBars[i] = {
      time: startTime + i * stepTime,
      open,
      high,
      low,
      close: targetClose,
      volume,
    };
  }

  // 2. Bar 35 (Selling Climax SC):
  // Climactic capitulation candle (open: 5.58, high: 5.62, low: 4.80, close: 5.18, volume: 420,000).
  // Establishes Trading Range (TR) support at $4.80.
  rawBars[35] = {
    time: startTime + 35 * stepTime,
    open: 5.58,
    high: 5.62,
    low: 4.80,
    close: 5.18,
    volume: 420000,
  };

  // 3. Bars 36–46 (Automatic Rally AR):
  // Institutional demand + short covering drives price up to peak at Bar 46 (high: 6.45, close: 6.32, volume: 230,000).
  // Establishes TR resistance at $6.45.
  for (let i = 36; i <= 45; i++) {
    const fraction = (i - 35) / (46 - 35);
    const targetClose = round2(5.18 + fraction * (6.20 - 5.18));
    const prevBar = rawBars[i - 1];
    const open = prevBar ? prevBar.close : 5.20;
    const high = round2(Math.max(open, targetClose) + 0.08);
    const low = round2(Math.min(open, targetClose) - 0.06);
    const volume = 150000 + Math.floor(fraction * 60000);
    rawBars[i] = {
      time: startTime + i * stepTime,
      open,
      high,
      low,
      close: targetClose,
      volume,
    };
  }

  // Bar 46 (AR peak):
  const bar45 = rawBars[45];
  rawBars[46] = {
    time: startTime + 46 * stepTime,
    open: bar45 ? bar45.close : 6.20,
    high: 6.45,
    low: 6.18,
    close: 6.32,
    volume: 230000,
  };

  // 4. Bars 47–58 (Secondary Test ST):
  // Price drifts back toward $4.80 support, bottoming at Bar 56 (open: 5.05, high: 5.09, low: 4.92, close: 5.02, volume: 82,000).
  // Narrow spread $0.17 and low volume compared to SC. Completes Phase A.
  for (let i = 47; i <= 55; i++) {
    const fraction = (i - 46) / (56 - 46);
    const targetClose = round2(6.32 - fraction * (6.32 - 5.05));
    const prevBar = rawBars[i - 1];
    const open = prevBar ? prevBar.close : 6.0;
    const high = round2(Math.max(open, targetClose) + 0.05);
    const low = round2(Math.min(open, targetClose) - 0.05);
    const volume = Math.floor(130000 - fraction * 45000);
    rawBars[i] = {
      time: startTime + i * stepTime,
      open,
      high,
      low,
      close: targetClose,
      volume,
    };
  }

  // Bar 56: Secondary Test bottom
  rawBars[56] = {
    time: startTime + 56 * stepTime,
    open: 5.05,
    high: 5.09,
    low: 4.92,
    close: 5.02,
    volume: 82000,
  };

  // Bars 57–58: completes Phase A
  rawBars[57] = {
    time: startTime + 57 * stepTime,
    open: 5.02,
    high: 5.16,
    low: 5.00,
    close: 5.12,
    volume: 85000,
  };
  rawBars[58] = {
    time: startTime + 58 * stepTime,
    open: 5.12,
    high: 5.24,
    low: 5.10,
    close: 5.20,
    volume: 90000,
  };

  // 5. Bars 59–125 (Phase B — Building a Cause):
  // Institutional accumulation inside [$4.80, $6.45].
  // Early bars (59–85) have wider swings ($5.00 to $6.35) and moderate volume (130,000).
  for (let i = 59; i <= 85; i++) {
    const angle = ((i - 59) / 26) * 3 * Math.PI;
    const targetPrice = round2(5.70 + 0.60 * Math.sin(angle));
    const prevBar = rawBars[i - 1];
    const open = prevBar ? prevBar.close : 5.70;
    const spread = 0.18;
    const high = round2(Math.max(open, targetPrice) + spread * 0.4);
    const low = round2(Math.min(open, targetPrice) - spread * 0.4);
    const volume = 125000 + ((i * 47) % 15000);
    rawBars[i] = {
      time: startTime + i * stepTime,
      open,
      high,
      low,
      close: targetPrice,
      volume,
    };
  }

  // Bars 86–91: advance toward resistance
  for (let i = 86; i <= 91; i++) {
    const fraction = (i - 85) / 6;
    const bar85 = rawBars[85];
    const baseClose = bar85 ? bar85.close : 5.70;
    const targetClose = round2(baseClose + fraction * (6.32 - baseClose));
    const prevBar = rawBars[i - 1];
    const open = prevBar ? prevBar.close : 6.0;
    const high = round2(Math.max(open, targetClose) + 0.08);
    const low = round2(Math.min(open, targetClose) - 0.05);
    const volume = 130000 + Math.floor(fraction * 15000);
    rawBars[i] = {
      time: startTime + i * stepTime,
      open,
      high,
      low,
      close: targetClose,
      volume,
    };
  }

  // Bar 92 (Upthrust UT in Phase B):
  // Slight Upthrust (high: 6.52, close: 6.28) before returning inside TR.
  const bar91 = rawBars[91];
  rawBars[92] = {
    time: startTime + 92 * stepTime,
    open: bar91 ? bar91.close : 6.32,
    high: 6.52,
    low: 6.24,
    close: 6.28,
    volume: 145000,
  };

  // Bars 93–94: return inside TR
  rawBars[93] = {
    time: startTime + 93 * stepTime,
    open: 6.28,
    high: 6.30,
    low: 6.12,
    close: 6.15,
    volume: 120000,
  };
  rawBars[94] = {
    time: startTime + 94 * stepTime,
    open: 6.15,
    high: 6.18,
    low: 6.00,
    close: 6.04,
    volume: 105000,
  };

  // Late Phase B bars (95–125):
  // Progressively narrower spreads (~$0.14 down to ~$0.13) and diminishing down-swing volume (~65,000)
  // as floating supply is absorbed.
  for (let i = 95; i <= 125; i++) {
    const fraction = (i - 95) / 30;
    const targetClose = round2(
      6.04 - fraction * (6.04 - 5.22) + 0.05 * Math.sin(fraction * 4 * Math.PI)
    );
    const prevBar = rawBars[i - 1];
    const open = prevBar ? prevBar.close : 5.80;
    const spread = round2(0.16 - fraction * 0.03);
    const high = round2(Math.max(open, targetClose) + spread * 0.45);
    const low = round2(Math.min(open, targetClose) - spread * 0.55);
    const volume = Math.floor(88000 - fraction * 25000 + ((i * 37) % 4000));
    rawBars[i] = {
      time: startTime + i * stepTime,
      open,
      high,
      low,
      close: targetClose,
      volume,
    };
  }

  // 6. Bars 126–145 (Phase C — Decisive Supply Test):
  // Bars 126–133: quiet dry volume hovering ~5.20–5.25, volume ~55,000–60,000, spread ~0.13
  for (let i = 126; i <= 133; i++) {
    const targetClose = round2(5.22 + 0.03 * Math.sin((i - 126) * 1.5));
    const prevBar = rawBars[i - 1];
    const open = prevBar ? prevBar.close : 5.22;
    const spread = 0.135;
    const high = round2(Math.max(open, targetClose) + 0.06);
    const low = round2(Math.min(open, targetClose) - (spread - (high - Math.max(open, targetClose))));
    const volume = Math.floor(58000 + ((i * 29) % 3000));
    rawBars[i] = {
      time: startTime + i * stepTime,
      open,
      high,
      low,
      close: targetClose,
      volume,
    };
  }

  if (variant === 'SCHEMATIC_2_LPS') {
    // Bar 134: tests supply higher up in TR (open: 5.22, high: 5.26, low: 5.14, close: 5.21, volume: 48,000)
    // Dry volume, narrow spread $0.12, holding well above $4.80.
    rawBars[134] = {
      time: startTime + 134 * stepTime,
      open: 5.22,
      high: 5.26,
      low: 5.14,
      close: 5.21,
      volume: 48000,
    };

    // Bar 135: followed immediately by a bullish demand bar (open: 5.21, high: 5.48, low: 5.19, close: 5.45, volume: 165,000)
    rawBars[135] = {
      time: startTime + 135 * stepTime,
      open: 5.21,
      high: 5.48,
      low: 5.19,
      close: 5.45,
      volume: 165000,
    };
  } else {
    // SCHEMATIC_1_SPRING:
    // Bar 134: bear-trap Spring below $4.80 (open: 4.86, high: 4.98, low: 4.62, close: 4.94, volume: 78,000)
    rawBars[134] = {
      time: startTime + 134 * stepTime,
      open: 4.86,
      high: 4.98,
      low: 4.62,
      close: 4.94,
      volume: 78000,
    };

    // Bar 135: bullish demand recovery candle back inside TR
    rawBars[135] = {
      time: startTime + 135 * stepTime,
      open: 4.94,
      high: 5.48,
      low: 4.91,
      close: 5.45,
      volume: 165000,
    };
  }

  // Bars 136–145: climb to $5.50
  for (let i = 136; i <= 145; i++) {
    const fraction = (i - 135) / 10;
    const targetClose = round2(5.45 + fraction * (5.50 - 5.45));
    const prevBar = rawBars[i - 1];
    const open = prevBar ? prevBar.close : 5.45;
    const spread = 0.08;
    const high = round2(Math.max(open, targetClose) + 0.04);
    const low = round2(Math.min(open, targetClose) - (spread - (high - Math.max(open, targetClose))));
    const volume = Math.floor(120000 + fraction * 30000);
    rawBars[i] = {
      time: startTime + i * stepTime,
      open,
      high,
      low,
      close: targetClose,
      volume,
    };
  }

  // 7. Bars 146–185 (Phase D — Dominance of Demand, SOS & LPS):
  // Bars 146–158 (SOS Advance): Wide-spread bullish bars on expanding volume (240,000–310,000) propel price from $5.50 to $6.58
  for (let i = 146; i <= 158; i++) {
    const fraction = (i - 145) / 13;
    const targetClose = round2(5.50 + fraction * (6.58 - 5.50));
    const prevBar = rawBars[i - 1];
    const open = prevBar ? prevBar.close : 5.50;
    const spread = 0.18 + fraction * 0.05;
    const high = round2(Math.max(open, targetClose) + 0.06);
    const low = round2(Math.min(open, targetClose) - (spread - (high - Math.max(open, targetClose))));
    const volume = Math.floor(240000 + fraction * 70000);
    rawBars[i] = {
      time: startTime + i * stepTime,
      open,
      high,
      low,
      close: targetClose,
      volume,
    };
  }

  // Bar 158: SOS peak at $6.58
  const bar157 = rawBars[157];
  rawBars[158] = {
    time: startTime + 158 * stepTime,
    open: bar157 ? bar157.close : 6.48,
    high: 6.64,
    low: bar157 ? bar157.close - 0.05 : 6.43,
    close: 6.58,
    volume: 310000,
  };

  // Bars 159–168 (LPS Pullback):
  // Quiet pullback on narrow spread ($0.09) and low volume (58,000) holding at $6.08
  for (let i = 159; i <= 165; i++) {
    const fraction = (i - 158) / 7;
    const targetClose = round2(6.58 - fraction * (6.58 - 6.12));
    const prevBar = rawBars[i - 1];
    const open = prevBar ? prevBar.close : 6.50;
    const spread = 0.09;
    const high = round2(Math.max(open, targetClose) + 0.04);
    const low = round2(Math.min(open, targetClose) - (spread - 0.04));
    const volume = Math.floor(75000 - fraction * 18000);
    rawBars[i] = {
      time: startTime + i * stepTime,
      open,
      high,
      low,
      close: targetClose,
      volume,
    };
  }

  // Bar 166 (LPS Pullback low holding at $6.08):
  // open: 6.12, high: 6.15, low: 6.06, close: 6.11, volume: 52,000
  rawBars[166] = {
    time: startTime + 166 * stepTime,
    open: 6.12,
    high: 6.15,
    low: 6.06,
    close: 6.11,
    volume: 52000,
  };

  // Bar 167 (Continuation candle):
  // open: 6.11, high: 6.46, low: 6.10, close: 6.42, volume: 225,000
  rawBars[167] = {
    time: startTime + 167 * stepTime,
    open: 6.11,
    high: 6.46,
    low: 6.10,
    close: 6.42,
    volume: 225000,
  };

  // Bars 168–185: consolidation near TR resistance $6.40–$6.46
  for (let i = 168; i <= 185; i++) {
    const fraction = (i - 167) / 18;
    const targetClose = round2(6.42 + 0.03 * Math.sin(fraction * 6 * Math.PI));
    const prevBar = rawBars[i - 1];
    const open = prevBar ? prevBar.close : 6.42;
    const spread = 0.08;
    const high = round2(Math.max(open, targetClose) + spread * 0.5);
    const low = round2(Math.min(open, targetClose) - spread * 0.5);
    const volume = Math.floor(120000 + ((i * 59) % 25000));
    rawBars[i] = {
      time: startTime + i * stepTime,
      open,
      high,
      low,
      close: targetClose,
      volume,
    };
  }

  // 8. Bars 186–239 (Phase E — Markup Outside the TR):
  // Bar 186: preparing breakout
  const bar185 = rawBars[185];
  rawBars[186] = {
    time: startTime + 186 * stepTime,
    open: bar185 ? bar185.close : 6.45,
    high: 6.52,
    low: 6.43,
    close: 6.48,
    volume: 220000,
  };

  // Bar 187: breaks decisively above $6.45 (close: 6.78, volume: 340,000)
  rawBars[187] = {
    time: startTime + 187 * stepTime,
    open: 6.48,
    high: 6.82,
    low: 6.46,
    close: 6.78,
    volume: 340000,
  };

  // Bars 188–193: continuation and mild pullback to Back-Up (BU)
  for (let i = 188; i <= 193; i++) {
    const fraction = (i - 187) / 6;
    const targetClose = round2(6.78 + (1 - fraction) * 0.15 - fraction * 0.20);
    const prevBar = rawBars[i - 1];
    const open = prevBar ? prevBar.close : 6.78;
    const high = round2(Math.max(open, targetClose) + 0.08);
    const low = round2(Math.min(open, targetClose) - 0.06);
    const volume = Math.floor(280000 - fraction * 150000);
    rawBars[i] = {
      time: startTime + i * stepTime,
      open,
      high,
      low,
      close: targetClose,
      volume,
    };
  }

  // Bar 194 (BU Back-Up to $6.55):
  const bar193 = rawBars[193];
  rawBars[194] = {
    time: startTime + 194 * stepTime,
    open: bar193 ? bar193.close : 6.62,
    high: 6.66,
    low: 6.55,
    close: 6.58,
    volume: 110000,
  };

  // Bars 195–239: trends steadily upward to $9.35 by Bar 239
  for (let i = 195; i <= 239; i++) {
    const fraction = (i - 194) / (239 - 194);
    const targetClose = round2(
      6.58 + fraction * (9.35 - 6.58) + 0.05 * Math.sin(fraction * 8 * Math.PI)
    );
    const prevBar = rawBars[i - 1];
    const open = prevBar ? prevBar.close : 6.60;
    const spread = 0.14;
    const high = round2(Math.max(open, targetClose) + 0.06);
    const low = round2(Math.min(open, targetClose) - (spread - (high - Math.max(open, targetClose))));
    const volume = Math.floor(140000 + ((i * 73) % 40000));
    rawBars[i] = {
      time: startTime + i * stepTime,
      open,
      high,
      low,
      close: targetClose,
      volume,
    };
  }

  // Bar 239: target markup exit peak
  const bar238 = rawBars[238];
  rawBars[239] = {
    time: startTime + 239 * stepTime,
    open: bar238 ? bar238.close : 9.28,
    high: 9.38,
    low: 9.25,
    close: 9.35,
    volume: 160000,
  };

  // Sanitize all bars ensuring strict OHLC invariants
  const bars: OHLCVBar[] = rawBars.map((b) => {
    const open = round2(b.open);
    const close = round2(b.close);
    const high = round2(Math.max(b.high, open, close));
    const low = round2(Math.min(b.low, open, close));
    const volume = Math.round(b.volume);
    return {
      time: b.time,
      open,
      high,
      low,
      close,
      volume,
    };
  });

  const isSchematic2 = variant === 'SCHEMATIC_2_LPS';

  return {
    id: isSchematic2 ? 'hnt-wyckoff-schematic-2' : 'hnt-wyckoff-schematic-1',
    symbol: 'HNTUSDTPERP',
    timeframe: '1H',
    description: isSchematic2
      ? 'Helium (HNTUSDTPERP) 1H — Wyckoff Accumulation Schematic #2 (Higher-Low LPS without Spring)'
      : 'Helium (HNTUSDTPERP) 1H — Wyckoff Accumulation Schematic #1 (Classic Spring below Support)',
    bars,
  };
}

export const HNT_SCHEMATIC_2_DATASET: MarketDataset = buildHntWyckoffDataset('SCHEMATIC_2_LPS');
export const HNT_SCHEMATIC_1_DATASET: MarketDataset = buildHntWyckoffDataset('SCHEMATIC_1_SPRING');

// Canonical aliases for cross-phase compatibility
export const HNT_WYCKOFF_SCHEMATIC_2_DATASET: MarketDataset = HNT_SCHEMATIC_2_DATASET;
export const HNT_WYCKOFF_SCHEMATIC_1_DATASET: MarketDataset = HNT_SCHEMATIC_1_DATASET;

export const BUILT_IN_DATASETS: readonly MarketDataset[] = [
  HNT_SCHEMATIC_2_DATASET,
  HNT_SCHEMATIC_1_DATASET,
];
