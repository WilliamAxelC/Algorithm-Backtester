export type AssetClass = 'IDX_LQ45' | 'US_EQUITY' | 'CRYPTO';

export type CurrencyCode = 'IDR' | 'USD';

export type CandleInterval = '1m' | '1h' | '1d';

export type TimeRangePreset =
  | '1D'
  | '1W'
  | '1M'
  | '3M'
  | '6M'
  | 'YTD'
  | '1Y'
  | '3Y'
  | '5Y'
  | '10Y'
  | 'ALL'
  | 'CUSTOM';

export interface TimeRangeFilter {
  readonly preset: TimeRangePreset;
  /** Unix timestamp in seconds (inclusive), or null for range preset calculation */
  readonly startTime: number | null;
  /** Unix timestamp in seconds (inclusive), or null for latest bar */
  readonly endTime: number | null;
}

export interface AssetMetadata {
  readonly symbol: string;
  /** Symbol formatted for Yahoo Finance or Binance API (e.g. 'BBCA.JK', 'AAPL', 'HNTUSDT') */
  readonly providerSymbol: string;
  readonly dataSource: 'YAHOO' | 'BINANCE';
  readonly name: string;
  readonly assetClass: AssetClass;
  readonly exchange: 'IDX' | 'NASDAQ' | 'NYSE' | 'BINANCE';
  readonly currency: CurrencyCode;
  /** 100 shares/lot for IDX LQ45, 1 share for US Equities, 0.001 for Crypto */
  readonly lotSize: number;
  readonly buyFeeBps: number;
  readonly sellFeeBps: number;
  readonly defaultSlippageBps: number;
  readonly defaultInitialCapital: number;
  readonly sector: string;
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

export interface LiveQuoteTick {
  readonly symbol: string;
  readonly price: number;
  readonly open24h: number;
  readonly high24h: number;
  readonly low24h: number;
  readonly volume24h: number;
  readonly changePct24h: number;
  readonly timestampSec: number;
  readonly isDelayed: boolean;
  readonly delayLabel: 'REALTIME_WS' | '15M_EXCHANGE_DELAY' | 'MARKET_CLOSED';
}

export type WyckoffPhaseId = 'NONE' | 'PHASE_A' | 'PHASE_B' | 'PHASE_C' | 'PHASE_D' | 'PHASE_E';

export type WyckoffEventTag =
  | 'PS'
  | 'SC'
  | 'AR'
  | 'ST'
  | 'UT'
  | 'SPRING'
  | 'SOS'
  | 'LPS'
  | 'BU'
  | 'ENTRY'
  | 'EXIT';

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
  readonly plainEnglishStory: string;
}

export interface HorizontalZoneAnnotation {
  readonly id: string;
  readonly startTime: number;
  readonly endTime: number;
  readonly supportPrice: number;
  readonly resistancePrice: number;
  readonly label: string;
}
