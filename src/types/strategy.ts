import type {
  OHLCVBar,
  ChartMarkerAnnotation,
  HorizontalZoneAnnotation,
  WyckoffPhaseId,
} from './market';

export type ParameterValue = number | boolean | string;

export interface StrategyParameterSchema {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly type: 'number' | 'boolean' | 'select';
  readonly defaultValue: ParameterValue;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly options?: readonly { readonly label: string; readonly value: string }[];
}

export type StrategyParameterMap = Readonly<Record<string, ParameterValue>>;

export type OrderAction = 'ENTER_LONG' | 'ADD_LONG' | 'EXIT_LONG' | 'HOLD';

export interface StrategyOrderIntent {
  readonly action: OrderAction;
  /** Fraction of available equity to allocate (0.01 to 1.0) when entering/adding */
  readonly allocationPct: number;
  /** Hard protective stop-loss price */
  readonly stopLossPrice: number | null;
  /** Optional target take-profit price */
  readonly takeProfitPrice: number | null;
  /** Concise human-readable reason logged in the trade ledger */
  readonly reason: string;
  /** Current semantic phase or state label */
  readonly phaseLabel: WyckoffPhaseId;
}

export interface OpenPositionSnapshot {
  readonly entryTime: number;
  readonly entryBarIndex: number;
  readonly averageEntryPrice: number;
  readonly quantity: number;
  readonly stopLossPrice: number | null;
  readonly takeProfitPrice: number | null;
  readonly additionsCount: number;
}

export interface StrategyContext {
  /** Strictly sliced historical bars up to and including the current bar: bars[0..currentIndex] */
  readonly bars: readonly OHLCVBar[];
  readonly currentIndex: number;
  readonly currentBar: OHLCVBar;
  readonly parameters: StrategyParameterMap;
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
  readonly version: string;
  readonly category: 'WYCKOFF_VSA' | 'TREND_FOLLOWING' | 'MEAN_REVERSION';
  readonly description: string;
  readonly parameters: readonly StrategyParameterSchema[];
  /** Initializes clean internal state before bar 0 */
  init(parameters: StrategyParameterMap): TState;
  /** Evaluates exactly one bar without look-ahead bias */
  onBar(context: StrategyContext, state: TState): {
    readonly nextState: TState;
    readonly output: StrategyStepOutput;
  };
}
