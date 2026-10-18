import type {
  AssetMetadata,
  OHLCVBar,
  ChartMarkerAnnotation,
  HorizontalZoneAnnotation,
  WyckoffPhaseId,
} from './market';

/**
 * Replaces complex mathematical indicator parameters with a simple, human-understandable posture:
 * - CONSERVATIVE: Stricter volume confirmation, wider stops, 60% max capital per trade
 * - BALANCED: Standard institutional thresholds, 85% max capital per trade
 * - AGGRESSIVE: Earlier phase entries + scale-in pyramiding up to 98% capital
 */
export type RiskPosture = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';

// Backwards compatibility for legacy parameter schemas prior to Phase 5
export type ParameterValue = number | boolean | string;

export interface StrategyParameterSchema {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly type: 'number' | 'boolean' | 'select';
  readonly defaultValue: ParameterValue;
  readonly min?: number | undefined;
  readonly max?: number | undefined;
  readonly step?: number | undefined;
  readonly options?: readonly { readonly label: string; readonly value: string }[] | undefined;
}

export type StrategyParameterMap = Readonly<Record<string, ParameterValue>>;

export type OrderAction = 'ENTER_LONG' | 'ADD_LONG' | 'EXIT_LONG' | 'HOLD';

export interface StrategyOrderIntent {
  readonly action: OrderAction;
  /** Target fraction of available equity (0.05 to 1.0) */
  readonly allocationPct: number;
  readonly stopLossPrice: number | null;
  readonly takeProfitPrice: number | null;
  /** Plain-English explanation shown in the Trade Ledger */
  readonly reason: string;
  readonly phaseLabel: WyckoffPhaseId;
}

export interface OpenPositionSnapshot {
  readonly entryTime: number;
  readonly entryBarIndex: number;
  readonly averageEntryPrice: number;
  readonly quantity: number;
  readonly lots?: number | undefined;
  readonly stopLossPrice: number | null;
  readonly takeProfitPrice: number | null;
  readonly additionsCount: number;
}

export interface StrategyContext {
  /** Strictly sliced historical bars up to currentIndex: bars[0..currentIndex] */
  readonly bars: readonly OHLCVBar[];
  readonly currentIndex: number;
  readonly currentBar: OHLCVBar;
  readonly asset?: AssetMetadata | undefined;
  readonly riskPosture?: RiskPosture | undefined;
  readonly openPosition: OpenPositionSnapshot | null;
  readonly equity: number;
  /** Backwards compatibility for legacy parameter map prior to Phase 5 */
  readonly parameters: StrategyParameterMap;
}

export interface StrategyStepOutput {
  readonly orderIntent: StrategyOrderIntent;
  readonly markers: readonly ChartMarkerAnnotation[];
  readonly activeZone: HorizontalZoneAnnotation | null;
}

export interface IStrategy<TState = unknown> {
  readonly id: string;
  readonly name: string;
  readonly shortBadge?: string | undefined;
  readonly category: 'WYCKOFF_VSA' | 'TREND_FOLLOWING' | 'MEAN_REVERSION';
  /** Clear, jargon-free explanation of how the algorithm works */
  readonly plainEnglishSummary?: string | undefined;
  /** Backwards compatibility for legacy metadata and parameters */
  readonly version?: string | undefined;
  readonly description?: string | undefined;
  readonly parameters: readonly StrategyParameterSchema[];

  /**
   * Initializes clean internal state before the first bar in the selected time range.
   * Supports both new RiskPosture and legacy parameter maps during transition.
   */
  init(riskPostureOrParams?: unknown, asset?: unknown): TState;

  /** Evaluates one bar with zero look-ahead bias */
  onBar(context: StrategyContext, state: TState): {
    readonly nextState: TState;
    readonly output: StrategyStepOutput;
  };
}
