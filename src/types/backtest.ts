import type {
  AssetMetadata,
  OHLCVBar,
  TimeRangeFilter,
  ChartMarkerAnnotation,
  HorizontalZoneAnnotation,
  WyckoffPhaseId,
} from './market';
import type { RiskPosture, StrategyParameterMap } from './strategy';

export interface BacktestConfig {
  readonly symbol?: string | undefined;
  readonly strategyId: string;
  readonly timeRange?: TimeRangeFilter | undefined;
  readonly riskPosture?: RiskPosture | undefined;
  readonly initialCapital: number;
  /** Backwards compatibility for legacy dataset and parameter configs */
  readonly datasetId?: string | undefined;
  readonly feeBps: number;
  readonly slippageBps: number;
  readonly parameters: StrategyParameterMap;
}

export type ExitReason = 'SIGNAL_EXIT' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'END_OF_RANGE' | 'END_OF_DATA';

export interface TradeRecord {
  readonly id: string;
  readonly entryTime: number;
  readonly exitTime: number;
  readonly entryBarIndex: number;
  readonly exitBarIndex: number;
  readonly entryPrice: number;
  readonly exitPrice: number;
  readonly quantity: number;
  readonly lots?: number | undefined;
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
  readonly strategyEquity?: number | undefined;
  readonly benchmarkEquity?: number | undefined;
  /** Backwards compatibility for legacy equity curve */
  readonly equity: number;
  readonly cash: number;
  readonly drawdownPct: number;
  readonly phase: WyckoffPhaseId;
}

export interface MonthlyReturnCell {
  readonly year: number;
  /** 1 = Jan ... 12 = Dec */
  readonly month: number;
  readonly returnPct: number;
  readonly tradesCount: number;
}

export interface PerformanceMetrics {
  readonly initialCapital: number;
  readonly finalEquity: number;
  readonly netProfit: number;
  readonly totalReturnPct: number;
  /** Return of buying and holding the asset over the exact same time range */
  readonly benchmarkReturnPct?: number | undefined;
  readonly benchmarkFinalEquity?: number | undefined;
  /** Strategy Total Return % minus Buy & Hold Return % */
  readonly alphaPct?: number | undefined;
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

export interface BacktestResult {
  readonly config: BacktestConfig;
  readonly asset?: AssetMetadata | undefined;
  readonly strategyName?: string | undefined;
  /** Backwards compatibility for legacy symbol property */
  readonly symbol?: string | undefined;
  readonly timeframe: '1H' | '4H' | '1D' | string;
  readonly bars: readonly OHLCVBar[];
  readonly trades: readonly TradeRecord[];
  readonly equityCurve: readonly EquityPoint[];
  readonly monthlyReturns?: readonly MonthlyReturnCell[] | undefined;
  readonly markers: readonly ChartMarkerAnnotation[];
  readonly zones: readonly HorizontalZoneAnnotation[];
  readonly metrics: PerformanceMetrics;
  readonly executionDurationMs: number;
}

export interface StrategyComparisonItem {
  readonly strategyId: string;
  readonly strategyName: string;
  readonly shortBadge: string;
  readonly category: string;
  readonly totalReturnPct: number;
  readonly alphaPct: number;
  readonly winRatePct: number;
  readonly maxDrawdownPct: number;
  readonly totalTrades: number;
  readonly sharpeRatio: number;
}
