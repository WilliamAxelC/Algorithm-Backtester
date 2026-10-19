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
  highestHigh,
  lowestLow,
} from '../utils/indicators';

export interface DonchianState {
  inTrade: boolean;
  entryPrice: number;
  entryBarIndex: number;
  trailingStopPrice: number;
  highestSinceEntry: number;
}

export const DonchianTrendStrategy: IStrategy<DonchianState> = {
  id: 'donchian-trend',
  name: 'Donchian Institutional Trend Breakout',
  shortBadge: 'DONCHIAN 20/10',
  category: 'TREND_FOLLOWING',
  nativeTimeframe: '1d',
  plainEnglishSummary:
    'Classic institutional trend-following algorithm entering on 20-period Donchian channel breakouts with volatility-scaled position sizing and exiting on 10-period channel lows or trailing ATR stops.',

  init(_riskPosture: RiskPosture, _asset: AssetMetadata): DonchianState {
    return {
      inTrade: false,
      entryPrice: 0,
      entryBarIndex: 0,
      trailingStopPrice: 0,
      highestSinceEntry: 0,
    };
  },

  onBar(context: StrategyContext, state: DonchianState): {
    nextState: DonchianState;
    output: StrategyStepOutput;
  } {
    const { bars, currentIndex, currentBar, riskPosture } = context;
    const markers: ChartMarkerAnnotation[] = [];
    let activeZone: HorizontalZoneAnnotation | null = null;
    let orderIntent: StrategyOrderIntent = {
      action: 'HOLD',
      allocationPct: 0,
      stopLossPrice: null,
      takeProfitPrice: null,
      reason: 'Tracking Donchian channel levels',
      phaseLabel: 'NONE',
    };

    if (currentIndex < 21) {
      return { nextState: state, output: { orderIntent, markers, activeZone } };
    }

    const atrArr = computeATR(bars, 20);
    const atr = atrArr[currentIndex] ?? Math.max(currentBar.close * 0.02, 0.01);

    const atrMult =
      riskPosture === 'CONSERVATIVE' ? 2.5 : riskPosture === 'AGGRESSIVE' ? 1.5 : 2.0;

    // 20-period upper channel (highest high of prior 20 bars, excluding current bar)
    const upper20 = highestHigh(bars, currentIndex - 20, currentIndex - 1);
    // 10-period lower channel (lowest low of prior 10 bars, excluding current bar)
    const lower10 = lowestLow(bars, currentIndex - 10, currentIndex - 1);

    activeZone = {
      id: `donchian-${currentBar.time}`,
      startTime: bars[Math.max(0, currentIndex - 20)]?.time ?? currentBar.time,
      endTime: currentBar.time,
      supportPrice: lower10,
      resistancePrice: upper20,
      label: `Donchian 20/10 Channel [${lower10.toFixed(2)} - ${upper20.toFixed(2)}]`,
    };

    let inTrade = state.inTrade;
    let entryPrice = state.entryPrice;
    let entryBarIndex = state.entryBarIndex;
    let trailingStop = state.trailingStopPrice;
    let highestSinceEntry = Math.max(state.highestSinceEntry, currentBar.high);

    if (!inTrade) {
      // Breakout: Current bar close or high crosses above 20-period high
      if (currentBar.close > upper20) {
        inTrade = true;
        entryPrice = currentBar.close;
        entryBarIndex = currentIndex;
        highestSinceEntry = currentBar.high;
        trailingStop = Math.max(lower10, currentBar.close - atr * atrMult);

        orderIntent = {
          action: 'ENTER_LONG',
          allocationPct: riskPosture === 'AGGRESSIVE' ? 1.0 : 0.9,
          stopLossPrice: trailingStop,
          takeProfitPrice: null,
          reason: `Donchian 20-Day Breakout above ${upper20.toFixed(2)}`,
          phaseLabel: 'PHASE_E',
        };

        markers.push({
          time: currentBar.time,
          barIndex: currentIndex,
          phase: 'PHASE_E',
          tag: 'ENTRY',
          price: currentBar.close,
          position: 'belowBar',
          shape: 'arrowUp',
          color: '#0D9488',
          label: 'BREAKOUT',
          plainEnglishStory: `20-Period High Breakout: Price closed at ${currentBar.close.toFixed(2)} > prior 20-bar high (${upper20.toFixed(2)}). Stop-loss set at ${trailingStop.toFixed(2)}.`,
        });
      }
    } else {
      // In Trade: Update trailing ATR stop
      const candidateStop = highestSinceEntry - atr * atrMult;
      if (candidateStop > trailingStop) {
        trailingStop = candidateStop;
      }

      // Exit condition: Close below 10-period low OR below trailing stop
      const exitTrigger = currentBar.close < lower10 || currentBar.close < trailingStop;
      if (exitTrigger) {
        inTrade = false;
        orderIntent = {
          action: 'EXIT_LONG',
          allocationPct: 1,
          stopLossPrice: null,
          takeProfitPrice: null,
          reason:
            currentBar.close < lower10
              ? `Breakdown below 10-Period Channel Low (${lower10.toFixed(2)})`
              : `Trailing ATR Stop Triggered at ${trailingStop.toFixed(2)}`,
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
          color: '#E11D48',
          label: 'TREND EXIT',
          plainEnglishStory: `Trend exit: Close at ${currentBar.close.toFixed(2)} triggered exit rule (10-bar low: ${lower10.toFixed(2)}, ATR stop: ${trailingStop.toFixed(2)}).`,
        });
      }
    }

    const nextState: DonchianState = {
      inTrade,
      entryPrice,
      entryBarIndex,
      trailingStopPrice: trailingStop,
      highestSinceEntry,
    };

    return {
      nextState,
      output: { orderIntent, markers, activeZone },
    };
  },
};
