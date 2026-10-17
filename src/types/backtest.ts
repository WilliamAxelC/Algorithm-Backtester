import type {
  OHLCVBar,
  ChartMarkerAnnotation,
  HorizontalZoneAnnotation,
  WyckoffPhaseId,
} from './market';
import type { StrategyParameterMap } from './strategy';

export interface BacktestConfig {
  readonly datasetId: string;
  readonly strategyId: string;
  readonly initialCapital: number;
  /** Trading commission in basis points (1 bp = 0.01%) */
  readonly feeBps: number;
  /** Execution slippage in basis points (1 bp = 0.01%) */
  readonly slippageBps: number;
  readonly parameters: StrategyParameterMap;
}

export type ExitReason = 'SIGNAL_EXIT' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'END_OF_DATA';

export interface TradeRecord {
  readonly id: string;
  readonly entryTime: number;
  readonly exitTime: number;
  readonly entryBarIndex: number;
  readonly exitBarIndex: number;
  readonly entryPrice: number;
  readonly exitPrice: number;
  readonly quantity: number;
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
  readonly equity: number;
  readonly cash: number;
  readonly drawdownPct: number;
  readonly phase: WyckoffPhaseId;
}

export interface PerformanceMetrics {
  readonly initialCapital: number;
  readonly finalEquity: number;
  readonly netProfit: number;
  readonly totalReturnPct: number;
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
  readonly symbol: string;
  readonly timeframe: string;
  readonly bars: readonly OHLCVBar[];
  readonly trades: readonly TradeRecord[];
  readonly equityCurve: readonly EquityPoint[];
  readonly markers: readonly ChartMarkerAnnotation[];
  readonly zones: readonly HorizontalZoneAnnotation[];
  readonly metrics: PerformanceMetrics;
  readonly executionDurationMs: number;
}
