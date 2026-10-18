export type AssetClass = 'CRYPTO' | 'IDX_LQ45' | 'US_EQUITY';

export type CurrencyCode = 'USD' | 'IDR';

export type TimeRangePreset = '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL' | 'CUSTOM';

export interface TimeRangeFilter {
  readonly preset: TimeRangePreset;
  /** Unix timestamp in seconds (inclusive), or null for dataset start */
  readonly startTime: number | null;
  /** Unix timestamp in seconds (inclusive), or null for dataset end */
  readonly endTime: number | null;
}

export interface AssetMetadata {
  readonly symbol: string;
  readonly name: string;
  readonly assetClass: AssetClass;
  readonly exchange: 'BINANCE' | 'IDX' | 'NASDAQ' | 'NYSE';
  readonly currency: CurrencyCode;
  readonly defaultTimeframe: '1H' | '4H' | '1D';
  /** Minimum shares/units per lot: 100 for IDX LQ45 stocks, 0.001 for Crypto, 1 for US Equities */
  readonly lotSize: number;
  /** Default buy commission + tax in basis points (e.g., 15 bps = 0.15% for IDX, 5 bps for Crypto) */
  readonly buyFeeBps: number;
  /** Default sell commission + tax in basis points (e.g., 25 bps = 0.25% for IDX, 5 bps for Crypto) */
  readonly sellFeeBps: number;
  readonly defaultSlippageBps: number;
  readonly defaultInitialCapital: number;
  readonly sector: string;
  readonly wyckoffVariant: 'SCHEMATIC_2_LPS' | 'SCHEMATIC_1_SPRING';
}

export interface OHLCVBar {
  /** Unix timestamp in seconds (UTC), strictly ascending */
  readonly time: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
}

export interface MarketDataset {
  readonly asset?: AssetMetadata | undefined;
  readonly timeframe: '1H' | '4H' | '1D' | string;
  readonly bars: readonly OHLCVBar[];
  // Backwards compatibility for pre-Phase-3 fixtures/loaders
  readonly id: string;
  readonly symbol: string;
  readonly description?: string | undefined;
}

export type WyckoffPhaseId = 'NONE' | 'PHASE_A' | 'PHASE_B' | 'PHASE_C' | 'PHASE_D' | 'PHASE_E';

export type WyckoffEventTag =
  | 'PS'      // Preliminary Support
  | 'SC'      // Selling Climax
  | 'AR'      // Automatic Rally
  | 'ST'      // Secondary Test
  | 'UT'      // Upthrust in Phase B
  | 'SPRING'  // Phase C Spring below TR Support (Schematic #1)
  | 'SOS'     // Sign of Strength
  | 'LPS'     // Last Point of Support (Schematic #2 Higher-Low Test or Phase D Pullback)
  | 'BU'      // Back-up to Trading Range Resistance
  | 'ENTRY'   // Generic Algorithm Long Entry
  | 'EXIT'    // Generic Algorithm Exit
  | 'SIGNAL'; // Legacy Generic Algorithm Signal

export interface ChartMarkerAnnotation {
  readonly time: number;
  readonly barIndex: number;
  readonly phase: WyckoffPhaseId;
  readonly tag: WyckoffEventTag;
  readonly price: number;
  readonly position: 'aboveBar' | 'belowBar';
  readonly shape: 'circle' | 'arrowUp' | 'arrowDown' | 'square';
  readonly color: '#0D9488' | '#E11D48' | '#2563EB' | '#D97706' | '#0F172A';
  readonly label: string;
  /** Plain-English explanation for non-technical traders */
  readonly plainEnglishStory?: string | undefined;
  /** Legacy rationale property for backwards compatibility */
  readonly rationale?: string | undefined;
}

export interface HorizontalZoneAnnotation {
  readonly id: string;
  readonly startTime: number;
  readonly endTime: number;
  readonly supportPrice: number;
  readonly resistancePrice: number;
  readonly label: string;
}
