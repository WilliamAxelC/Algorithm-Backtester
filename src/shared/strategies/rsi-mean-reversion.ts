import type {
  AssetMetadata,
  ChartMarkerAnnotation,
  HorizontalZoneAnnotation,
} from '../types/market';
import type {
  IStrategy,
  RiskPosture,
  StrategyContext,
  StrategyOrderIntent,
  StrategyStepOutput,
} from '../types/strategy';
import {
  computeATR,
  computeRSI,
  computeSMA,
} from '../utils/indicators';

export interface RsiState {
  inTrade: boolean;
  entryPrice: number;
  entryBarIndex: number;
  stopLossPrice: number;
  takeProfitPrice: number;
}

export const RsiMeanReversionStrategy: IStrategy<RsiState> = {
  id: 'rsi-mean-reversion',
  name: 'RSI Volatility Mean Reversion',
  shortBadge: 'RSI MEAN-REV',
  category: 'MEAN_REVERSION',
  nativeTimeframe: '1h',
  plainEnglishSummary:
    'Volatility-calibrated mean reversion algorithm capturing intraday oversold pullbacks (RSI 14 < 30) within larger macro uptrends, exiting quickly as RSI reaches overbought expansion (RSI > 65).',

  init(_riskPosture: RiskPosture, _asset: AssetMetadata): RsiState {
    return {
      inTrade: false,
      entryPrice: 0,
      entryBarIndex: 0,
      stopLossPrice: 0,
      takeProfitPrice: 0,
    };
  },

  onBar(context: StrategyContext, state: RsiState): {
    nextState: RsiState;
    output: StrategyStepOutput;
  } {
    const { bars, currentIndex, currentBar, riskPosture } = context;
    const markers: ChartMarkerAnnotation[] = [];
    const activeZone: HorizontalZoneAnnotation | null = null;
    let orderIntent: StrategyOrderIntent = {
      action: 'HOLD',
      allocationPct: 0,
      stopLossPrice: null,
      takeProfitPrice: null,
      reason: 'Monitoring RSI oversold pullbacks',
      phaseLabel: 'NONE',
    };

    if (currentIndex < 50) {
      return { nextState: state, output: { orderIntent, markers, activeZone } };
    }

    const rsiArr = computeRSI(bars, 14);
    const sma50Arr = computeSMA(bars, 50);
    const atrArr = computeATR(bars, 14);

    const rsi = rsiArr[currentIndex] ?? 50;
    const prevRsi = rsiArr[currentIndex - 1] ?? 50;
    const sma50 = sma50Arr[currentIndex] ?? currentBar.close;
    const atr = atrArr[currentIndex] ?? Math.max(currentBar.close * 0.015, 0.01);

    const oversoldThreshold = riskPosture === 'AGGRESSIVE' ? 35 : 30;
    const overboughtThreshold = riskPosture === 'CONSERVATIVE' ? 60 : 65;
    const stopMult = riskPosture === 'CONSERVATIVE' ? 2.5 : riskPosture === 'AGGRESSIVE' ? 1.5 : 2.0;

    let inTrade = state.inTrade;
    let entryPrice = state.entryPrice;
    let entryBarIndex = state.entryBarIndex;
    let stopLossPrice = state.stopLossPrice;
    let takeProfitPrice = state.takeProfitPrice;

    if (!inTrade) {
      // Entry setup:
      // 1. Price is in general uptrend (close >= sma50 * 0.98)
      // 2. RSI hooks upward out of oversold territory (prevRsi < oversold && rsi >= prevRsi)
      const inTrend = currentBar.close >= sma50 * 0.98;
      const rsiOversoldHook = prevRsi <= oversoldThreshold && rsi > prevRsi;

      if (inTrend && rsiOversoldHook) {
        inTrade = true;
        entryPrice = currentBar.close;
        entryBarIndex = currentIndex;
        stopLossPrice = currentBar.close - atr * stopMult;
        takeProfitPrice = currentBar.close + atr * (stopMult * 1.8);

        orderIntent = {
          action: 'ENTER_LONG',
          allocationPct: riskPosture === 'AGGRESSIVE' ? 1.0 : 0.85,
          stopLossPrice,
          takeProfitPrice,
          reason: `RSI Oversold Pullback (RSI: ${rsi.toFixed(1)} < ${oversoldThreshold})`,
          phaseLabel: 'PHASE_C',
        };

        markers.push({
          time: currentBar.time,
          barIndex: currentIndex,
          phase: 'PHASE_C',
          tag: 'ENTRY',
          price: currentBar.close,
          position: 'belowBar',
          shape: 'arrowUp',
          color: '#0D9488',
          label: 'RSI BUY',
          plainEnglishStory: `RSI Oversold Reversal: RSI hooked to ${rsi.toFixed(1)} while price holds near SMA50. Stop at ${stopLossPrice.toFixed(2)}, target at ${takeProfitPrice.toFixed(2)}.`,
        });
      }
    } else {
      // Exit condition:
      // 1. RSI reaches overbought target
      // 2. Close below stop loss
      // 3. Time stop: held for > 30 bars without hitting target
      const rsiOverbought = rsi >= overboughtThreshold;
      const stopHit = currentBar.close <= stopLossPrice;
      const targetHit = currentBar.close >= takeProfitPrice;
      const timeStop = currentIndex - entryBarIndex > 48;

      if (rsiOverbought || stopHit || targetHit || timeStop) {
        inTrade = false;
        const exitReason = stopHit
          ? `Stop Loss Hit at ${stopLossPrice.toFixed(2)}`
          : targetHit
          ? `Take Profit Hit at ${takeProfitPrice.toFixed(2)}`
          : rsiOverbought
          ? `RSI Overbought Target Reached (${rsi.toFixed(1)})`
          : 'Mean Reversion Time Limit (48 bars)';

        orderIntent = {
          action: 'EXIT_LONG',
          allocationPct: 1,
          stopLossPrice: null,
          takeProfitPrice: null,
          reason: exitReason,
          phaseLabel: 'PHASE_E',
        };

        markers.push({
          time: currentBar.time,
          barIndex: currentIndex,
          phase: 'PHASE_E',
          tag: 'EXIT',
          price: currentBar.close,
          position: 'aboveBar',
          shape: 'arrowDown',
          color: stopHit ? '#E11D48' : '#0D9488',
          label: stopHit ? 'RSI STOP' : 'RSI TP',
          plainEnglishStory: `Mean Reversion Exit: ${exitReason}. Exit price ${currentBar.close.toFixed(2)}.`,
        });
      }
    }

    const nextState: RsiState = {
      inTrade,
      entryPrice,
      entryBarIndex,
      stopLossPrice,
      takeProfitPrice,
    };

    return {
      nextState,
      output: { orderIntent, markers, activeZone },
    };
  },
};
