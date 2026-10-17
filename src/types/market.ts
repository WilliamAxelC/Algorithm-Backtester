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
  readonly id: string;
  readonly symbol: string;
  readonly timeframe: string;
  readonly description: string;
  readonly bars: readonly OHLCVBar[];
}

export type WyckoffPhaseId = 'NONE' | 'PHASE_A' | 'PHASE_B' | 'PHASE_C' | 'PHASE_D' | 'PHASE_E';

export type WyckoffEventTag =
  | 'PS'      // Preliminary Support
  | 'SC'      // Selling Climax
  | 'AR'      // Automatic Rally
  | 'ST'      // Secondary Test
  | 'UT'      // Upthrust in Phase B
  | 'SPRING'  // Phase C Spring below TR Support
  | 'SOS'     // Sign of Strength
  | 'LPS'     // Last Point of Support (Schematic #1 or Schematic #2)
  | 'BU'      // Back-up to Creek / Breakout
  | 'SIGNAL'; // Generic algorithm signal for non-Wyckoff strategies

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
  readonly rationale: string;
}

export interface HorizontalZoneAnnotation {
  readonly id: string;
  readonly startTime: number;
  readonly endTime: number;
  readonly supportPrice: number;
  readonly resistancePrice: number;
  readonly label: string;
}
