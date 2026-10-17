import type {
  ChartMarkerAnnotation,
  HorizontalZoneAnnotation,
  OHLCVBar,
} from '../types/market';
import type {
  IStrategy,
  StrategyContext,
  StrategyParameterMap,
  StrategyParameterSchema,
  StrategyStepOutput,
} from '../types/strategy';
import {
  computeATR,
  highestHigh,
  lowestLow,
} from '../utils/indicators';

export interface DonchianState {
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
    key: 'atrStopMult',
    label: 'ATR Stop Multiplier',
    description: 'Multiplier for ATR trailing stop-loss',
    type: 'number',
    defaultValue: 2.0,
    min: 1.0,
    max: 5.0,
    step: 0.25,
  },
];

function initDonchianState(_parameters: StrategyParameterMap): DonchianState {
  return {
    inPosition: false,
    entryPrice: 0,
    highestPrice: 0,
    stopLoss: null,
  };
}

function evaluateDonchianBar(
  context: StrategyContext,
  state: DonchianState
): { readonly nextState: DonchianState; readonly output: StrategyStepOutput } {
  const entryPeriodParam = context.parameters.entryChannelPeriod;
  const entryPeriod = typeof entryPeriodParam === 'number' ? entryPeriodParam : 20;

  const exitPeriodParam = context.parameters.exitChannelPeriod;
  const exitPeriod = typeof exitPeriodParam === 'number' ? exitPeriodParam : 10;

  const atrStopParam = context.parameters.atrStopMult;
  const atrStopMult = typeof atrStopParam === 'number' ? atrStopParam : 2.0;

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

  const startBarIndex = Math.max(0, bars.length - entryPeriod);
  const startBar: OHLCVBar | undefined = bars[startBarIndex];
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

  if (context.openPosition === null) {
    if (currentBar.close > upper) {
      const stop = currentBar.close - atrStopMult * atr;
      markers.push({
        time: currentBar.time,
        barIndex: context.currentIndex,
        phase: 'NONE',
        tag: 'SIGNAL',
        price: currentBar.low,
        position: 'belowBar',
        shape: 'arrowUp',
        color: '#0D9488',
        label: 'BUY',
        rationale: `Donchian upper channel breakout at ${currentBar.close.toFixed(2)} > ${upper.toFixed(2)}`,
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
            allocationPct: 1.0,
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
  } else {
    if (currentBar.close < lower) {
      markers.push({
        time: currentBar.time,
        barIndex: context.currentIndex,
        phase: 'NONE',
        tag: 'SIGNAL',
        price: currentBar.high,
        position: 'aboveBar',
        shape: 'arrowDown',
        color: '#E11D48',
        label: 'EXIT',
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

    const newHigh = Math.max(state.highestPrice, currentBar.close);
    const candidateStop = newHigh - atrStopMult * atr;
    const trailedStop = state.stopLoss !== null ? Math.max(state.stopLoss, candidateStop) : candidateStop;

    return {
      nextState: {
        inPosition: true,
        entryPrice: state.entryPrice,
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

  return {
    nextState: state,
    output: {
      orderIntent: {
        action: 'HOLD',
        allocationPct: 0,
        stopLossPrice: null,
        takeProfitPrice: null,
        reason: 'Scanning for Donchian channel breakout',
        phaseLabel: 'NONE',
      },
      markers,
      activeZone,
    },
  };
}

export const DonchianBreakoutStrategy: IStrategy<DonchianState> = {
  id: 'donchian-breakout',
  name: 'Donchian Channel Trend Breakout',
  version: '1.0.0',
  category: 'TREND_FOLLOWING',
  description:
    'Classic Donchian Channel breakout strategy with dynamic ATR trailing stops, proving modular plug-and-play algorithm architecture.',
  parameters: DONCHIAN_PARAMETERS,
  init: initDonchianState,
  onBar: evaluateDonchianBar,
};
