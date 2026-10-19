import type {
  AssetMetadata,
  ChartMarkerAnnotation,
  HorizontalZoneAnnotation,
  WyckoffEventTag,
  WyckoffPhaseId,
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
  computeSpreadRatio,
  computeVolumeRatio,
  lowestLow,
} from '../utils/indicators';

export interface WyckoffState {
  phase: WyckoffPhaseId;
  tradingRangeStartBar: number;
  tradingRangeStartTime: number;
  supportPrice: number;
  resistancePrice: number;
  scPrice: number;
  arPrice: number;
  springDetected: boolean;
  springLowPrice: number;
  schematicType: 'SCHEMATIC_1_SPRING' | 'SCHEMATIC_2_HIGHER_LOW' | 'NONE';
  inTrade: boolean;
  entryPrice: number;
  trailingStopPrice: number;
  barsInCurrentPhase: number;
  lastExitBarIndex: number;
}

export const WyckoffAccumulationV2Strategy: IStrategy<WyckoffState> = {
  id: 'wyckoff-accumulation-v2',
  name: 'Wyckoff Accumulation Schematics #1 & #2',
  shortBadge: 'WYCKOFF #1/#2',
  category: 'WYCKOFF_VSA',
  nativeTimeframe: '1d',
  plainEnglishSummary:
    'Institutional smart-money accumulation algorithm detecting Phase A climaxes, Phase B absorption, Phase C Springs & higher-low LPS tests, and Phase D/E trend markups with ATR trailing stops.',

  init(_riskPosture: RiskPosture, _asset: AssetMetadata): WyckoffState {
    return {
      phase: 'NONE',
      tradingRangeStartBar: 0,
      tradingRangeStartTime: 0,
      supportPrice: 0,
      resistancePrice: 0,
      scPrice: 0,
      arPrice: 0,
      springDetected: false,
      springLowPrice: 0,
      schematicType: 'NONE',
      inTrade: false,
      entryPrice: 0,
      trailingStopPrice: 0,
      barsInCurrentPhase: 0,
      lastExitBarIndex: -100,
    };
  },

  onBar(context: StrategyContext, state: WyckoffState): {
    nextState: WyckoffState;
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
      reason: 'Observing market structure',
      phaseLabel: state.phase,
    };

    // Need minimal warm-up
    if (currentIndex < 25) {
      return {
        nextState: { ...state, barsInCurrentPhase: state.barsInCurrentPhase + 1 },
        output: { orderIntent, markers, activeZone },
      };
    }

    const atrArr = computeATR(bars, 20);
    const volRatioArr = computeVolumeRatio(bars, 20);
    const spreadRatioArr = computeSpreadRatio(bars, 20);

    const atr = atrArr[currentIndex] ?? Math.max(currentBar.close * 0.02, 0.01);
    const volRatio = volRatioArr[currentIndex] ?? 1.0;
    const spreadRatio = spreadRatioArr[currentIndex] ?? 1.0;
    const prevBar = bars[currentIndex - 1] ?? currentBar;

    // Multiplier thresholds based on Risk Posture
    const stopAtrMultiplier =
      riskPosture === 'CONSERVATIVE' ? 2.5 : riskPosture === 'AGGRESSIVE' ? 1.5 : 2.0;

    let nextPhase = state.phase;
    let support = state.supportPrice;
    let resistance = state.resistancePrice;
    let sc = state.scPrice;
    let ar = state.arPrice;
    let springDetected = state.springDetected;
    let springLow = state.springLowPrice;
    let schematic = state.schematicType;
    let inTrade = state.inTrade;
    let entryPrice = state.entryPrice;
    let trailingStop = state.trailingStopPrice;
    let trStartBar = state.tradingRangeStartBar;
    let trStartTime = state.tradingRangeStartTime;
    let lastExit = state.lastExitBarIndex;

    const addMarker = (
      tag: WyckoffEventTag,
      price: number,
      pos: 'aboveBar' | 'belowBar',
      shape: 'circle' | 'arrowUp' | 'arrowDown' | 'square',
      color: '#0D9488' | '#E11D48' | '#2563EB' | '#D97706' | '#0F172A',
      label: string,
      story: string
    ) => {
      markers.push({
        time: currentBar.time,
        barIndex: currentIndex,
        phase: nextPhase,
        tag,
        price,
        position: pos,
        shape,
        color,
        label,
        plainEnglishStory: story,
      });
    };

    // Helper: Reset state after trade exit to find next accumulation cycle
    const resetToScan = () => {
      nextPhase = 'NONE';
      support = 0;
      resistance = 0;
      sc = 0;
      ar = 0;
      springDetected = false;
      springLow = 0;
      schematic = 'NONE';
      inTrade = false;
      entryPrice = 0;
      trailingStop = 0;
      lastExit = currentIndex;
    };

    // -------------------------------------------------------------
    // State Machine: NONE -> PHASE_A -> PHASE_B -> PHASE_C -> PHASE_D -> PHASE_E
    // -------------------------------------------------------------

    if (nextPhase === 'NONE') {
      // Look for Selling Climax (SC) after downtrend
      // Downtrend check: 20-bar lowest low or low below 20-bar SMA
      const isLowestIn20 = currentBar.low <= lowestLow(bars, currentIndex - 20, currentIndex - 1);
      const isClimacticVolume = volRatio >= 1.6;
      const isWideSpread = spreadRatio >= 1.3;
      const cooldownPassed = currentIndex - lastExit > 8;

      if (isLowestIn20 && isClimacticVolume && isWideSpread && cooldownPassed) {
        nextPhase = 'PHASE_A';
        support = currentBar.low;
        sc = currentBar.low;
        resistance = currentBar.high + atr;
        ar = resistance;
        trStartBar = currentIndex;
        trStartTime = currentBar.time;

        addMarker(
          'SC',
          currentBar.low,
          'belowBar',
          'square',
          '#E11D48',
          'SC',
          `Selling Climax (SC) detected: heavy volume ${volRatio.toFixed(1)}x with wide spread ${spreadRatio.toFixed(1)}x stopping the prior decline.`
        );
      }
    } else if (nextPhase === 'PHASE_A') {
      // Establish Automatic Rally (AR) and Secondary Test (ST)
      if (currentBar.high > resistance) {
        resistance = currentBar.high;
        ar = currentBar.high;
      }

      // Check for Secondary Test (ST) holding above or near SC low on reduced volume
      const retestingSupport = currentBar.low <= support * 1.02 && currentBar.low >= support * 0.97;
      const volumeDrying = volRatio < 1.3;

      if (retestingSupport && volumeDrying && currentIndex - trStartBar >= 3) {
        nextPhase = 'PHASE_B';
        addMarker(
          'ST',
          currentBar.low,
          'belowBar',
          'circle',
          '#D97706',
          'ST',
          `Secondary Test (ST) successful: price tested SC support ($${support.toFixed(2)}) with contracted volume (${volRatio.toFixed(1)}x). Trading Range established.`
        );
      } else if (currentIndex - trStartBar > 25) {
        // Prolonged without ST, advance or re-evaluate
        nextPhase = 'PHASE_B';
      }
    } else if (nextPhase === 'PHASE_B') {
      // Trading Range supply absorption. Check for Upthrust (UT)
      if (currentBar.high > resistance && currentBar.close < resistance) {
        addMarker(
          'UT',
          currentBar.high,
          'aboveBar',
          'arrowDown',
          '#D97706',
          'UT',
          `Upthrust (UT) in Phase B: temporary probe above resistance ($${resistance.toFixed(2)}) rejected back into Trading Range.`
        );
      }

      const trDuration = currentIndex - trStartBar;

      // Check transition to Phase C:
      // Case 1: Schematic #1 (Spring) - dip below support that reverses back inside
      const dippedBelowSupport = currentBar.low < support && currentBar.close >= support * 0.985;
      const springDryingVolume = volRatio <= 1.5;

      if (trDuration >= 8 && dippedBelowSupport && springDryingVolume) {
        nextPhase = 'PHASE_C';
        schematic = 'SCHEMATIC_1_SPRING';
        springDetected = true;
        springLow = currentBar.low;
        support = Math.min(support, currentBar.low); // Update bottom of TR

        addMarker(
          'SPRING',
          currentBar.low,
          'belowBar',
          'arrowUp',
          '#0D9488',
          'SPRING',
          `Wyckoff Spring (Schematic #1): terminal shakeout below support to $${currentBar.low.toFixed(2)} with light volume. Smart money absorbing floating supply.`
        );

        // Immediate Long entry on Spring confirmation
        if (!inTrade) {
          inTrade = true;
          entryPrice = currentBar.close;
          trailingStop = springLow - atr * 0.5;

          orderIntent = {
            action: 'ENTER_LONG',
            allocationPct: riskPosture === 'AGGRESSIVE' ? 1.0 : 0.9,
            stopLossPrice: trailingStop,
            takeProfitPrice: resistance + atr * 4,
            reason: 'Wyckoff Phase C Spring Entry (Schematic #1)',
            phaseLabel: 'PHASE_C',
          };

          addMarker(
            'ENTRY',
            currentBar.close,
            'belowBar',
            'arrowUp',
            '#0D9488',
            'BUY',
            `Long Entry on Phase C Spring confirmation at $${currentBar.close.toFixed(2)}. Initial stop below Spring low ($${trailingStop.toFixed(2)}).`
          );
        }
      } else if (trDuration >= 12) {
        // Case 2: Schematic #2 (Higher-Low LPS without Spring)
        // Price forms a higher low in the lower half of the TR with dry volume, then breaks upward
        const midTr = (support + resistance) / 2;
        const inLowerHalf = currentBar.low > support && currentBar.low < midTr;
        const dryVolume = volRatio < 1.0;
        const bullishBar = currentBar.close > currentBar.open && currentBar.close > prevBar.high;

        if (inLowerHalf && dryVolume && bullishBar) {
          nextPhase = 'PHASE_C';
          schematic = 'SCHEMATIC_2_HIGHER_LOW';
          addMarker(
            'LPS',
            currentBar.low,
            'belowBar',
            'circle',
            '#2563EB',
            'LPS',
            `Wyckoff Higher-Low LPS (Schematic #2): higher low established at $${currentBar.low.toFixed(2)} with dry volume without a Spring. Institutional accumulation complete.`
          );

          if (!inTrade) {
            inTrade = true;
            entryPrice = currentBar.close;
            trailingStop = currentBar.low - atr * 0.75;

            orderIntent = {
              action: 'ENTER_LONG',
              allocationPct: riskPosture === 'AGGRESSIVE' ? 1.0 : 0.85,
              stopLossPrice: trailingStop,
              takeProfitPrice: resistance + atr * 3.5,
              reason: 'Wyckoff Phase C Higher-Low LPS Entry (Schematic #2)',
              phaseLabel: 'PHASE_C',
            };

            addMarker(
              'ENTRY',
              currentBar.close,
              'belowBar',
              'arrowUp',
              '#0D9488',
              'BUY',
              `Long Entry on Schematic #2 Higher-Low at $${currentBar.close.toFixed(2)}. Stop at $${trailingStop.toFixed(2)}.`
            );
          }
        }
      }
    } else if (nextPhase === 'PHASE_C') {
      // Moving out of Phase C into Phase D (Sign of Strength - SOS)
      if (currentBar.close > resistance) {
        nextPhase = 'PHASE_D';
        addMarker(
          'SOS',
          currentBar.high,
          'aboveBar',
          'arrowUp',
          '#0D9488',
          'SOS',
          `Sign of Strength (SOS): decisive breakout above Trading Range resistance ($${resistance.toFixed(2)}) with expanding spread.`
        );

        // Raise trailing stop to break-even or support
        trailingStop = Math.max(trailingStop, support);
      } else if (inTrade && currentBar.close < trailingStop) {
        // Stop hit
        orderIntent = {
          action: 'EXIT_LONG',
          allocationPct: 1,
          stopLossPrice: null,
          takeProfitPrice: null,
          reason: 'Phase C setup invalidated by break below stop level',
          phaseLabel: 'PHASE_C',
        };
        resetToScan();
      }
    } else if (nextPhase === 'PHASE_D') {
      // Phase D: Markup inside/above range, looking for Back-Up (BU) to TR
      const pullBackToResistance =
        currentBar.low <= resistance * 1.02 && currentBar.close >= resistance * 0.98;

      if (pullBackToResistance && volRatio < 1.2) {
        nextPhase = 'PHASE_E';
        addMarker(
          'BU',
          currentBar.low,
          'belowBar',
          'circle',
          '#2563EB',
          'BU',
          `Back-Up to TR Resistance (BU): normal test of breakout level ($${resistance.toFixed(2)}) on light volume, confirming support.`
        );

        // Scale-in or advance trailing stop
        trailingStop = Math.max(trailingStop, resistance - atr * 1.0);
      } else if (currentBar.close > resistance + atr * 2) {
        nextPhase = 'PHASE_E';
      }

      if (inTrade && currentBar.close < trailingStop) {
        orderIntent = {
          action: 'EXIT_LONG',
          allocationPct: 1,
          stopLossPrice: null,
          takeProfitPrice: null,
          reason: 'Phase D trailing stop hit',
          phaseLabel: 'PHASE_D',
        };
        resetToScan();
      }
    } else if (nextPhase === 'PHASE_E') {
      // Phase E: Full Trend Markup! Trail ATR stop dynamically
      const newStop = currentBar.close - atr * stopAtrMultiplier;
      if (newStop > trailingStop) {
        trailingStop = newStop;
      }

      // Exit condition: Close below dynamic ATR trailing stop
      if (inTrade && (currentBar.close < trailingStop || currentBar.low < trailingStop)) {
        orderIntent = {
          action: 'EXIT_LONG',
          allocationPct: 1,
          stopLossPrice: null,
          takeProfitPrice: null,
          reason: `Phase E trend exhaustion: Trailing ATR stop triggered at $${trailingStop.toFixed(2)}`,
          phaseLabel: 'PHASE_E',
        };
        resetToScan();
      } else if (currentIndex - trStartBar > 120 && currentBar.close < prevBar.close) {
        // If trade has run for >120 bars and momentum slows, protect gains
        const tightStop = currentBar.close - atr * 1.5;
        if (tightStop > trailingStop) trailingStop = tightStop;
      }
    }

    // Produce Active Zone Annotation if in active TR
    if (support > 0 && resistance > support && nextPhase !== 'NONE') {
      activeZone = {
        id: `wyckoff-tr-${trStartTime}`,
        startTime: trStartTime,
        endTime: currentBar.time,
        supportPrice: support,
        resistancePrice: resistance,
        label: `Wyckoff TR [${support.toFixed(2)} - ${resistance.toFixed(2)}] (${schematic === 'SCHEMATIC_1_SPRING' ? 'Sch #1 Spring' : schematic === 'SCHEMATIC_2_HIGHER_LOW' ? 'Sch #2 LPS' : 'Base'})`,
      };
    }

    const nextState: WyckoffState = {
      phase: nextPhase,
      tradingRangeStartBar: trStartBar,
      tradingRangeStartTime: trStartTime,
      supportPrice: support,
      resistancePrice: resistance,
      scPrice: sc,
      arPrice: ar,
      springDetected,
      springLowPrice: springLow,
      schematicType: schematic,
      inTrade,
      entryPrice,
      trailingStopPrice: trailingStop,
      barsInCurrentPhase: nextPhase === state.phase ? state.barsInCurrentPhase + 1 : 1,
      lastExitBarIndex: lastExit,
    };

    return {
      nextState,
      output: {
        orderIntent,
        markers,
        activeZone,
      },
    };
  },
};
