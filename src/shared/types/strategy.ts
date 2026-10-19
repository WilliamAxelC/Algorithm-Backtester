import type {
  AssetMetadata,
  CandleInterval,
  OHLCVBar,
  ChartMarkerAnnotation,
  HorizontalZoneAnnotation,
  WyckoffPhaseId,
} from './market';

export type RiskPosture = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';

export type OrderAction = 'ENTER_LONG' | 'ADD_LONG' | 'EXIT_LONG' | 'HOLD';

export interface StrategyOrderIntent {
  readonly action: OrderAction;
  readonly allocationPct: number;
  readonly stopLossPrice: number | null;
  readonly takeProfitPrice: number | null;
  readonly reason: string;
  readonly phaseLabel: WyckoffPhaseId;
}

export interface OpenPositionSnapshot {
  readonly entryTime: number;
  readonly entryBarIndex: number;
  readonly averageEntryPrice: number;
  readonly quantity: number;
  readonly lots: number;
  readonly stopLossPrice: number | null;
  readonly takeProfitPrice: number | null;
  readonly additionsCount: number;
}

export interface StrategyContext {
  /** Strictly sliced historical bars on the strategy's nativeTimeframe: bars[0..currentIndex] */
  readonly bars: readonly OHLCVBar[];
  readonly currentIndex: number;
  readonly currentBar: OHLCVBar;
  readonly asset: AssetMetadata;
  readonly riskPosture: RiskPosture;
  readonly openPosition: OpenPositionSnapshot | null;
  readonly equity: number;
}

export interface StrategyStepOutput {
  readonly orderIntent: StrategyOrderIntent;
  readonly markers: readonly ChartMarkerAnnotation[];
  readonly activeZone: HorizontalZoneAnnotation | null;
}

export interface IStrategy<TState = unknown> {
  readonly id: string;
  readonly name: string;
  readonly shortBadge: string;
  readonly category: 'WYCKOFF_VSA' | 'TREND_FOLLOWING' | 'MEAN_REVERSION';
  /** The optimal candle interval this strategy executes on regardless of chart zoom ('1d' or '1h') */
  readonly nativeTimeframe: CandleInterval;
  readonly plainEnglishSummary: string;
  init(riskPosture: RiskPosture, asset: AssetMetadata): TState;
  onBar(context: StrategyContext, state: TState): {
    readonly nextState: TState;
    readonly output: StrategyStepOutput;
  };
}
