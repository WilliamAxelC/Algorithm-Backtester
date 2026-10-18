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
import { computeATR, computeRSI } from '../utils/indicators';

export interface RsiInternalState {
  readonly inPosition: boolean;
  readonly entryPrice: number;
  readonly highestPrice: number;
  readonly stopLoss: number | null;
  readonly prevRsi: number | null;
}

const RSI_PARAMETERS: readonly StrategyParameterSchema[] = [
  {
    key: 'rsiPeriod',
    label: 'RSI Period',
    description: 'Lookback period for Relative Strength Index',
    type: 'number',
    defaultValue: 14,
    min: 5,
    max: 50,
    step: 1,
  },
  {
    key: 'oversoldThreshold',
    label: 'Oversold Threshold',
    description: 'RSI level to trigger oversold mean-reversion long entry',
    type: 'number',
    defaultValue: 32,
    min: 15,
    max: 45,
    step: 1,
  },
  {
    key: 'overboughtThreshold',
    label: 'Overbought Threshold',
    description: 'RSI level to trigger overbought profit-taking exit',
    type: 'number',
    defaultValue: 68,
    min: 55,
    max: 85,
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
    step: 0.1,
  },
];

export function initRsiState(
  _riskPostureOrParams?: unknown,
  _asset?: unknown
): RsiInternalState {
  return {
    inPosition: false,
    entryPrice: 0,
    highestPrice: 0,
    stopLoss: null,
    prevRsi: null,
  };
}

export function evaluateRsiBar(
  context: StrategyContext,
  state: RsiInternalState
): { readonly nextState: RsiInternalState; readonly output: StrategyStepOutput } {
  // Self-calibrates based on riskPosture:
  // - CONSERVATIVE: RSI period 14, oversoldThreshold 28, overboughtThreshold 65, allocationPct 0.60, atrStopMult 2.5.
  // - BALANCED: RSI period 14, oversoldThreshold 32, overboughtThreshold 68, allocationPct 0.85, atrStopMult 2.0.
  // - AGGRESSIVE: RSI period 14, oversoldThreshold 36, overboughtThreshold 72, allocationPct 0.98, atrStopMult 1.8.
  const posture: RiskPosture =
    context.riskPosture ??
    (context.parameters.riskPosture === 'CONSERVATIVE' ||
    context.parameters.riskPosture === 'AGGRESSIVE' ||
    context.parameters.riskPosture === 'BALANCED'
      ? context.parameters.riskPosture
      : 'BALANCED');

  let baseRsiPeriod = 14;
  let baseOversold = 32;
  let baseOverbought = 68;
  let baseAllocation = 0.85;
  let baseAtrStopMult = 2.0;

  if (posture === 'CONSERVATIVE') {
    baseRsiPeriod = 14;
    baseOversold = 28;
    baseOverbought = 65;
    baseAllocation = 0.60;
    baseAtrStopMult = 2.5;
  } else if (posture === 'AGGRESSIVE') {
    baseRsiPeriod = 14;
    baseOversold = 36;
    baseOverbought = 72;
    baseAllocation = 0.98;
    baseAtrStopMult = 1.8;
  }

  const params = context.parameters;
  const rsiPeriod =
    typeof params.rsiPeriod === 'number' ? params.rsiPeriod : baseRsiPeriod;
  const oversoldThreshold =
    typeof params.oversoldThreshold === 'number'
      ? params.oversoldThreshold
      : baseOversold;
  const overboughtThreshold =
    typeof params.overboughtThreshold === 'number'
      ? params.overboughtThreshold
      : baseOverbought;
  const atrStopMult =
    typeof params.atrStopMult === 'number'
      ? params.atrStopMult
      : typeof params.atrStopMultiplier === 'number'
      ? params.atrStopMultiplier
      : baseAtrStopMult;
  const allocationPct =
    typeof params.allocationPct === 'number'
      ? params.allocationPct
      : typeof params.maxAllocation === 'number'
      ? params.maxAllocation
      : baseAllocation;

  const currentBar = context.currentBar;
  const bars = context.bars;

  if (bars.length < rsiPeriod + 1) {
    return {
      nextState: state,
      output: {
        orderIntent: {
          action: 'HOLD',
          allocationPct: 0,
          stopLossPrice: null,
          takeProfitPrice: null,
          reason: 'Accumulating initial RSI lookback bars',
          phaseLabel: 'NONE',
        },
        markers: [],
        activeZone: null,
      },
    };
  }

  const rsi = computeRSI(bars, rsiPeriod);
  const atr = computeATR(bars, 14);
  const markers: ChartMarkerAnnotation[] = [];
  const activeZone: HorizontalZoneAnnotation | null = null;

  // 1. If not currently holding an open position in the portfolio
  if (context.openPosition === null) {
    const isOversold = rsi <= oversoldThreshold;
    const isCrossingAboveFromOversold =
      state.prevRsi !== null &&
      state.prevRsi < oversoldThreshold &&
      rsi >= oversoldThreshold;

    if (isOversold || isCrossingAboveFromOversold) {
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
        label: 'RSI-OS',
        plainEnglishStory: `RSI Oversold Entry: RSI(${rsiPeriod}) at ${rsi.toFixed(1)} reached or crossed oversold threshold (${oversoldThreshold}), signaling an institutional value zone.`,
        rationale: `RSI oversold entry: RSI ${rsi.toFixed(1)} <= ${oversoldThreshold}`,
      });

      return {
        nextState: {
          inPosition: true,
          entryPrice: currentBar.close,
          highestPrice: currentBar.close,
          stopLoss: stop,
          prevRsi: rsi,
        },
        output: {
          orderIntent: {
            action: 'ENTER_LONG',
            allocationPct,
            stopLossPrice: stop,
            takeProfitPrice: null,
            reason: `RSI oversold entry at ${rsi.toFixed(1)} <= ${oversoldThreshold}`,
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
        prevRsi: rsi,
      },
      output: {
        orderIntent: {
          action: 'HOLD',
          allocationPct: 0,
          stopLossPrice: null,
          takeProfitPrice: null,
          reason: `Scanning for RSI oversold condition (RSI=${rsi.toFixed(1)} > ${oversoldThreshold})`,
          phaseLabel: 'NONE',
        },
        markers,
        activeZone,
      },
    };
  }

  // 2. Currently holding an open position in portfolio
  if (rsi >= overboughtThreshold) {
    markers.push({
      time: currentBar.time,
      barIndex: context.currentIndex,
      phase: 'NONE',
      tag: 'EXIT',
      price: currentBar.high,
      position: 'aboveBar',
      shape: 'arrowDown',
      color: '#E11D48',
      label: 'RSI-OB',
      plainEnglishStory: `RSI Overbought Exit: RSI(${rsiPeriod}) at ${rsi.toFixed(1)} reached overbought threshold (${overboughtThreshold}), taking profit as momentum normalizes.`,
      rationale: `RSI overbought exit: RSI ${rsi.toFixed(1)} >= ${overboughtThreshold}`,
    });

    return {
      nextState: {
        inPosition: false,
        entryPrice: 0,
        highestPrice: 0,
        stopLoss: null,
        prevRsi: rsi,
      },
      output: {
        orderIntent: {
          action: 'EXIT_LONG',
          allocationPct: 0,
          stopLossPrice: null,
          takeProfitPrice: null,
          reason: `RSI overbought exit at ${rsi.toFixed(1)} >= ${overboughtThreshold}`,
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
      prevRsi: rsi,
    },
    output: {
      orderIntent: {
        action: 'HOLD',
        allocationPct: 0,
        stopLossPrice: trailedStop,
        takeProfitPrice: null,
        reason: `Holding RSI mean reversion position (RSI=${rsi.toFixed(1)})`,
        phaseLabel: 'NONE',
      },
      markers,
      activeZone,
    },
  };
}

export const RsiMeanReversionStrategy: IStrategy<RsiInternalState> = {
  id: 'rsi-mean-reversion',
  name: 'RSI Institutional Mean Reversion',
  shortBadge: 'RSI REVERSION',
  category: 'MEAN_REVERSION',
  plainEnglishSummary:
    'Captures oversold liquidity flushes inside an overarching trend (RSI < 30-35) and takes profit as momentum normalizes toward fair value (RSI > 65-70).',
  version: '2.0.0',
  description:
    'Captures oversold liquidity flushes inside an overarching trend (RSI < 30-35) and takes profit as momentum normalizes toward fair value (RSI > 65-70).',
  parameters: RSI_PARAMETERS,
  init: initRsiState,
  onBar: evaluateRsiBar,
};
