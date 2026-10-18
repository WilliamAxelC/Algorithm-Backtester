import type {
  ChartMarkerAnnotation,
  HorizontalZoneAnnotation,
} from '../types/market';
import type {
  IStrategy,
  RiskPosture,
  StrategyContext,
  StrategyParameterSchema,
  StrategyStepOutput,
} from '../types/strategy';
import {
  computeATR,
  computeVolumeRatio,
  highestHigh,
  lowestLow,
} from '../utils/indicators';

export interface DonchianInternalState {
  readonly inPosition: boolean;
  readonly entryPrice: number;
  readonly highestPrice: number;
  readonly stopLoss: number | null;
}

const DONCHIAN_PARAMETERS: readonly StrategyParameterSchema[] = [
  {
    key: 'entryChannelPeriod',
    label: 'Entry Channel Period',
    description: 'Lookback bars for Donchian Channel breakout high',
    type: 'number',
    defaultValue: 20,
    min: 5,
    max: 100,
    step: 1,
  },
  {
    key: 'exitChannelPeriod',
    label: 'Exit Channel Period',
    description: 'Lookback bars for Donchian Channel exit low',
    type: 'number',
    defaultValue: 10,
    min: 2,
    max: 50,
    step: 1,
  },
  {
    key: 'volumeRatioThreshold',
    label: 'Volume Ratio Threshold',
    description: 'Minimum volume ratio required on channel breakout',
    type: 'number',
    defaultValue: 1.05,
    min: 0.8,
    max: 2.0,
    step: 0.05,
  },
  {
    key: 'atrStopMult',
    label: 'ATR Stop Multiplier',
    description: 'Multiplier for ATR dynamic trailing stop-loss',
    type: 'number',
    defaultValue: 1.8,
    min: 1.0,
    max: 5.0,
    step: 0.1,
  },
];

export function initDonchianState(
  _riskPostureOrParams?: unknown,
  _asset?: unknown
): DonchianInternalState {
  return {
    inPosition: false,
    entryPrice: 0,
    highestPrice: 0,
    stopLoss: null,
  };
}

export function evaluateDonchianBar(
  context: StrategyContext,
  state: DonchianInternalState
): { readonly nextState: DonchianInternalState; readonly output: StrategyStepOutput } {
  // Self-calibrates based on riskPosture:
  // - CONSERVATIVE: entryChannelPeriod 20, exitChannelPeriod 10, volumeRatioThreshold 1.2, allocationPct 0.60, atrStopMult 2.2.
  // - BALANCED: entryChannelPeriod 20, exitChannelPeriod 10, volumeRatioThreshold 1.05, allocationPct 0.85, atrStopMult 1.8.
  // - AGGRESSIVE: entryChannelPeriod 15, exitChannelPeriod 10, volumeRatioThreshold 0.95, allocationPct 0.98, atrStopMult 1.5.
  const posture: RiskPosture =
    context.riskPosture ??
    (context.parameters.riskPosture === 'CONSERVATIVE' ||
    context.parameters.riskPosture === 'AGGRESSIVE' ||
    context.parameters.riskPosture === 'BALANCED'
      ? context.parameters.riskPosture
      : 'BALANCED');

  let baseEntryPeriod = 20;
  let baseExitPeriod = 10;
  let baseVolRatioThreshold = 1.05;
  let baseAllocationPct = 0.85;
  let baseAtrStopMult = 1.8;

  if (posture === 'CONSERVATIVE') {
    baseEntryPeriod = 20;
    baseExitPeriod = 10;
    baseVolRatioThreshold = 1.2;
    baseAllocationPct = 0.60;
    baseAtrStopMult = 2.2;
  } else if (posture === 'AGGRESSIVE') {
    baseEntryPeriod = 15;
    baseExitPeriod = 10;
    baseVolRatioThreshold = 0.95;
    baseAllocationPct = 0.98;
    baseAtrStopMult = 1.5;
  }

  const params = context.parameters;
  const entryPeriodParam = params.entryChannelPeriod;
  const entryPeriod =
    typeof entryPeriodParam === 'number' ? entryPeriodParam : baseEntryPeriod;

  const exitPeriodParam = params.exitChannelPeriod;
  const exitPeriod =
    typeof exitPeriodParam === 'number' ? exitPeriodParam : baseExitPeriod;

  const atrStopParam = params.atrStopMult ?? params.atrStopMultiplier;
  const atrStopMult =
    typeof atrStopParam === 'number' ? atrStopParam : baseAtrStopMult;

  const volRatioParam = params.volumeRatioThreshold;
  const volumeRatioThreshold =
    typeof volRatioParam === 'number' ? volRatioParam : baseVolRatioThreshold;

  const allocParam = params.allocationPct ?? params.maxAllocation;
  const allocationPct =
    typeof allocParam === 'number' ? allocParam : baseAllocationPct;

  const currentBar = context.currentBar;
  const bars = context.bars;

  if (bars.length < entryPeriod + 1) {
    return {
      nextState: state,
      output: {
        orderIntent: {
          action: 'HOLD',
          allocationPct: 0,
          stopLossPrice: null,
          takeProfitPrice: null,
          reason: 'Accumulating initial lookback bars',
          phaseLabel: 'NONE',
        },
        markers: [],
        activeZone: null,
      },
    };
  }

  const upper = highestHigh(bars, entryPeriod, 1);
  const lower = lowestLow(bars, exitPeriod, 1);
  const atr = computeATR(bars, 14);
  const volRatio = computeVolumeRatio(bars, 20);

  const startBarIndex = Math.max(0, bars.length - entryPeriod);
  const startBar = bars[startBarIndex];
  const startTime = startBar ? startBar.time : currentBar.time;

  const activeZone: HorizontalZoneAnnotation = {
    id: 'donchian-channel',
    startTime,
    endTime: currentBar.time,
    supportPrice: lower,
    resistancePrice: upper,
    label: `Donchian [${lower.toFixed(2)} - ${upper.toFixed(2)}]`,
  };

  const markers: ChartMarkerAnnotation[] = [];

  // When not currently holding an open position
  if (context.openPosition === null) {
    if (currentBar.close > upper && volRatio >= volumeRatioThreshold) {
      const stop = currentBar.close - atrStopMult * atr;
      markers.push({
        time: currentBar.time,
        barIndex: context.currentIndex,
        phase: 'NONE',
        tag: 'ENTRY',
        price: currentBar.low,
        position: 'belowBar',
        shape: 'arrowUp',
        color: '#0D9488',
        label: 'BUY',
        plainEnglishStory: `Donchian upper channel breakout: price closed at ${currentBar.close.toFixed(2)} above ${upper.toFixed(2)} with expanding volume (${volRatio.toFixed(2)}x).`,
        rationale: `Donchian upper channel breakout at ${currentBar.close.toFixed(2)} > ${upper.toFixed(2)} with volume ratio ${volRatio.toFixed(2)}`,
      });

      return {
        nextState: {
          inPosition: true,
          entryPrice: currentBar.close,
          highestPrice: currentBar.close,
          stopLoss: stop,
        },
        output: {
          orderIntent: {
            action: 'ENTER_LONG',
            allocationPct,
            stopLossPrice: stop,
            takeProfitPrice: null,
            reason: `Donchian upper breakout above ${upper.toFixed(2)}`,
            phaseLabel: 'NONE',
          },
          markers,
          activeZone,
        },
      };
    }

    return {
      nextState: {
        inPosition: false,
        entryPrice: 0,
        highestPrice: 0,
        stopLoss: null,
      },
      output: {
        orderIntent: {
          action: 'HOLD',
          allocationPct: 0,
          stopLossPrice: null,
          takeProfitPrice: null,
          reason: 'Scanning for Donchian channel breakout with volume expansion',
          phaseLabel: 'NONE',
        },
        markers,
        activeZone,
      },
    };
  }

  // When holding an open position
  if (currentBar.close < lower) {
    markers.push({
      time: currentBar.time,
      barIndex: context.currentIndex,
      phase: 'NONE',
      tag: 'EXIT',
      price: currentBar.high,
      position: 'aboveBar',
      shape: 'arrowDown',
      color: '#E11D48',
      label: 'EXIT',
      plainEnglishStory: `Donchian lower channel breakdown: price closed at ${currentBar.close.toFixed(2)} below ${exitPeriod}-bar low (${lower.toFixed(2)}).`,
      rationale: `Donchian lower channel breakdown at ${currentBar.close.toFixed(2)} < ${lower.toFixed(2)}`,
    });

    return {
      nextState: {
        inPosition: false,
        entryPrice: 0,
        highestPrice: 0,
        stopLoss: null,
      },
      output: {
        orderIntent: {
          action: 'EXIT_LONG',
          allocationPct: 0,
          stopLossPrice: null,
          takeProfitPrice: null,
          reason: `Donchian breakdown below ${lower.toFixed(2)}`,
          phaseLabel: 'NONE',
        },
        markers,
        activeZone,
      },
    };
  }

  // Trailing stop update
  const newHigh = Math.max(state.highestPrice, currentBar.close);
  const candidateStop = newHigh - atrStopMult * atr;
  const trailedStop =
    state.stopLoss !== null
      ? Math.max(state.stopLoss, candidateStop)
      : candidateStop;

  return {
    nextState: {
      inPosition: true,
      entryPrice: state.entryPrice > 0 ? state.entryPrice : currentBar.close,
      highestPrice: newHigh,
      stopLoss: trailedStop,
    },
    output: {
      orderIntent: {
        action: 'HOLD',
        allocationPct: 0,
        stopLossPrice: trailedStop,
        takeProfitPrice: null,
        reason: 'Holding Donchian trend with dynamic trailing stop',
        phaseLabel: 'NONE',
      },
      markers,
      activeZone,
    },
  };
}

export const DonchianTrendStrategy: IStrategy<DonchianInternalState> = {
  id: 'donchian-trend',
  name: 'Donchian Channel Breakout & Trend Following',
  shortBadge: 'DONCHIAN TREND',
  category: 'TREND_FOLLOWING',
  plainEnglishSummary:
    'Enters long when price breaks out to a rolling 20-bar high with expanding volume. Rides the trend and exits when price falls below the rolling 10-bar low.',
  version: '2.0.0',
  description:
    'Enters long when price breaks out to a rolling 20-bar high with expanding volume. Rides the trend and exits when price falls below the rolling 10-bar low.',
  parameters: DONCHIAN_PARAMETERS,
  init: initDonchianState,
  onBar: evaluateDonchianBar,
};

export const DonchianBreakoutStrategy: IStrategy<DonchianInternalState> = {
  ...DonchianTrendStrategy,
  id: 'donchian-breakout',
};
