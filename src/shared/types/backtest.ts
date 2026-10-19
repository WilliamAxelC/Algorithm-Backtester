import type {
  AssetMetadata,
  CandleInterval,
  OHLCVBar,
  TimeRangeFilter,
  ChartMarkerAnnotation,
  HorizontalZoneAnnotation,
  WyckoffPhaseId,
} from './market';
import type { RiskPosture } from './strategy';

export interface BacktestConfig {
  readonly symbol: string;
  readonly strategyId: string;
  readonly timeRange: TimeRangeFilter;
  readonly riskPosture: RiskPosture;
  readonly initialCapital: number;
}

export type ExitReason = 'SIGNAL_EXIT' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'END_OF_RANGE';

export interface TradeRecord {
  readonly id: string;
  readonly entryTime: number;
  readonly exitTime: number;
  readonly entryBarIndex: number;
  readonly exitBarIndex: number;
  readonly entryPrice: number;
  readonly exitPrice: number;
  readonly quantity: number;
  readonly lots: number;
  readonly grossPnl: number;
  readonly totalFees: number;
  readonly netPnl: number;
  readonly returnPct: number;
  readonly holdingBars: number;
  readonly entryReason: string;
  readonly exitReason: ExitReason;
  readonly exitDetail: string;
  readonly entryPhase: WyckoffPhaseId;
}

export interface EquityPoint {
  readonly time: number;
  readonly barIndex: number;
  readonly strategyEquity: number;
  readonly benchmarkEquity: number;
  readonly cash: number;
  readonly drawdownPct: number;
  readonly phase: WyckoffPhaseId;
}

export interface MonthlyReturnCell {
  readonly year: number;
  readonly month: number;
  readonly returnPct: number;
  readonly tradesCount: number;
}

export interface PerformanceMetrics {
  readonly initialCapital: number;
  readonly finalEquity: number;
  readonly netProfit: number;
  readonly totalReturnPct: number;
  readonly benchmarkReturnPct: number;
  readonly benchmarkFinalEquity: number;
  readonly alphaPct: number;
  readonly maxDrawdownPct: number;
  readonly winRatePct: number;
  readonly profitFactor: number;
  readonly sharpeRatio: number;
  readonly sortinoRatio: number;
  readonly expectancyPerTrade: number;
  readonly totalTrades: number;
  readonly winningTrades: number;
  readonly losingTrades: number;
  readonly avgHoldingBars: number;
  readonly exposurePct: number;
}

export interface BacktestApiResponse {
  readonly config: BacktestConfig;
  readonly asset: AssetMetadata;
  readonly strategyName: string;
  /** The candle interval the algorithm executed on ('1d' or '1h') */
  readonly executionInterval: CandleInterval;
  /** The candle interval returned for chart display ('1d' for >=1Y, '1h' for 1W..6M, '1m' for 1D) */
  readonly displayInterval: CandleInterval;
  /** Display candles for the selected time range */
  readonly displayBars: readonly OHLCVBar[];
  readonly trades: readonly TradeRecord[];
  readonly equityCurve: readonly EquityPoint[];
  readonly monthlyReturns: readonly MonthlyReturnCell[];
  readonly markers: readonly ChartMarkerAnnotation[];
  readonly zones: readonly HorizontalZoneAnnotation[];
  readonly metrics: PerformanceMetrics;
  readonly openPosition: {
    readonly entryTime: number;
    readonly entryPrice: number;
    readonly quantity: number;
    readonly lots: number;
    readonly stopLossPrice: number | null;
  } | null;
  readonly prerenderedAtIso: string;
  readonly computeTimeMs: number;
}
