import type {
  AssetMetadata,
  ChartMarkerAnnotation,
  HorizontalZoneAnnotation,
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
  highestHigh,
  lowestLow,
} from '../utils/indicators';

export interface WyckoffState {
  readonly phase: WyckoffPhaseId;
  readonly phaseStep:
    | 'NONE'
    | 'PS_FOUND'
    | 'SC_FOUND'
    | 'AR_FOUND'
    | 'ST_FOUND'
    | 'IN_PHASE_B'
    | 'SPRING_FOUND'
    | 'LPS_FOUND'
    | 'SOS_FOUND'
    | 'PHASE_E_MARKUP';
  readonly tradingRangeStartBar: number;
  readonly tradingRangeStartTime: number;
  readonly supportPrice: number;
  readonly resistancePrice: number;
  readonly scBarIndex: number;
  readonly scLow: number;
  readonly scVolRatio: number;
  readonly arBarIndex: number;
  readonly arHigh: number;
  readonly stBarIndex: number;
  readonly stLow: number;
  readonly springBarIndex: number;
  readonly springLowPrice: number;
  readonly schematicType: 'SCHEMATIC_1_SPRING' | 'SCHEMATIC_2_HIGHER_LOW' | 'NONE';
  readonly barsInPhaseB: number;
  readonly upthrustCount: number;
  readonly phaseBDownVolumeSum: number;
  readonly phaseBDownBarsCount: number;
  readonly phaseBUpVolumeSum: number;
  readonly phaseBUpBarsCount: number;
  readonly inTrade: boolean;
  readonly entryPrice: number;
  readonly trailingStopPrice: number;
  readonly highestHighSinceBreakout: number;
  readonly lastMarkerBarIndex: number;
  readonly lastExitBarIndex: number;
  readonly consecutiveBreakdownCloses: number;
  readonly lastSosBarIndex: number;
  readonly buRetestLogged: boolean;
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
      phaseStep: 'NONE',
      tradingRangeStartBar: 0,
      tradingRangeStartTime: 0,
      supportPrice: 0,
      resistancePrice: 0,
      scBarIndex: -100,
      scLow: 0,
      scVolRatio: 0,
      arBarIndex: -100,
      arHigh: 0,
      stBarIndex: -100,
      stLow: 0,
      springBarIndex: -100,
      springLowPrice: 0,
      schematicType: 'NONE',
      barsInPhaseB: 0,
      upthrustCount: 0,
      phaseBDownVolumeSum: 0,
      phaseBDownBarsCount: 0,
      phaseBUpVolumeSum: 0,
      phaseBUpBarsCount: 0,
      inTrade: false,
      entryPrice: 0,
      trailingStopPrice: 0,
      highestHighSinceBreakout: 0,
      lastMarkerBarIndex: -100,
      lastExitBarIndex: -100,
      consecutiveBreakdownCloses: 0,
      lastSosBarIndex: -100,
      buRetestLogged: false,
    };
  },

  onBar(context: StrategyContext, state: WyckoffState): {
    nextState: WyckoffState;
    output: StrategyStepOutput;
  } {
    const { bars, currentIndex: i, currentBar, riskPosture } = context;
    const markers: ChartMarkerAnnotation[] = [];
    let activeZone: HorizontalZoneAnnotation | null = null;
    let orderIntent: StrategyOrderIntent = {
      action: 'HOLD',
      allocationPct: 0,
      stopLossPrice: null,
      takeProfitPrice: null,
      reason: 'Observing structural price action',
      phaseLabel: state.phase,
    };

    // Need minimal warm-up
    if (i < 20) {
      return {
        nextState: state,
        output: { orderIntent, markers, activeZone },
      };
    }

    // 1. Quantitative VSA Primitives computed at Bar i
    const atrArr = computeATR(bars, 20);
    const volRatioArr = computeVolumeRatio(bars, 20);
    const spreadRatioArr = computeSpreadRatio(bars, 20);

    const atr20 = atrArr[i] ?? Math.max(currentBar.close * 0.02, 0.01);
    const volRatio20 = volRatioArr[i] ?? 1.0;
    const spread = Math.max(currentBar.high - currentBar.low, 1e-6);
    const spreadRatio20 = spreadRatioArr[i] ?? 1.0;
    const closePosition = (currentBar.close - currentBar.low) / spread;

    // Prior 50-bar swing high (lookback 5..55 bars before current)
    const priorHigh50 = highestHigh(bars, Math.max(0, i - 55), Math.max(0, i - 5));
    const drawdownFromHighAtr = atr20 > 0 ? (priorHigh50 - currentBar.low) / atr20 : 0;

    // Mutable working state
    let phase = state.phase;
    let phaseStep = state.phaseStep;
    let tradingRangeStartBar = state.tradingRangeStartBar;
    let tradingRangeStartTime = state.tradingRangeStartTime;
    let supportPrice = state.supportPrice;
    let resistancePrice = state.resistancePrice;
    let scBarIndex = state.scBarIndex;
    let scLow = state.scLow;
    let scVolRatio = state.scVolRatio;
    let arBarIndex = state.arBarIndex;
    let arHigh = state.arHigh;
    let stBarIndex = state.stBarIndex;
    let stLow = state.stLow;
    let springBarIndex = state.springBarIndex;
    let springLowPrice = state.springLowPrice;
    let schematicType = state.schematicType;
    let barsInPhaseB = state.barsInPhaseB;
    let upthrustCount = state.upthrustCount;
    let phaseBDownVolumeSum = state.phaseBDownVolumeSum;
    let phaseBDownBarsCount = state.phaseBDownBarsCount;
    let phaseBUpVolumeSum = state.phaseBUpVolumeSum;
    let phaseBUpBarsCount = state.phaseBUpBarsCount;
    let inTrade = state.inTrade;
    let entryPrice = state.entryPrice;
    let trailingStopPrice = state.trailingStopPrice;
    let highestHighSinceBreakout = state.highestHighSinceBreakout;
    let lastMarkerBarIndex = state.lastMarkerBarIndex;
    let lastExitBarIndex = state.lastExitBarIndex;
    let consecutiveBreakdownCloses = state.consecutiveBreakdownCloses;
    let lastSosBarIndex = state.lastSosBarIndex;
    let buRetestLogged = state.buRetestLogged;

    // -------------------------------------------------------------------------
    // 2. Strict Phase A State Machine (Stopping the Downtrend)
    // -------------------------------------------------------------------------
    const cooldownBars = riskPosture === 'AGGRESSIVE' ? 6 : 10;
    const canStartNewCycle = i - lastExitBarIndex >= cooldownBars;
    const minDowntrendAtr = riskPosture === 'AGGRESSIVE' ? 2.8 : 3.5;

    // Preliminary Support (PS)
    if (
      phase === 'NONE' &&
      phaseStep === 'NONE' &&
      canStartNewCycle &&
      drawdownFromHighAtr >= 2.5 &&
      volRatio20 >= 1.3 &&
      closePosition >= 0.35 &&
      i - lastMarkerBarIndex >= 3
    ) {
      markers.push({
        time: currentBar.time,
        barIndex: i,
        phase: 'PHASE_A',
        tag: 'PS',
        price: currentBar.low,
        position: 'belowBar',
        shape: 'circle',
        color: '#2563EB',
        label: 'PS',
        plainEnglishStory: `Preliminary Support (PS) detected at ${currentBar.low.toFixed(2)}: Initial institutional buying halts waterfall decline on ${volRatio20.toFixed(1)}x volume.`,
      });
      phaseStep = 'PS_FOUND';
      lastMarkerBarIndex = i;
    }

    // Selling Climax (SC)
    if (
      (phase === 'NONE' || phaseStep === 'PS_FOUND') &&
      canStartNewCycle &&
      drawdownFromHighAtr >= minDowntrendAtr
    ) {
      const lookbackLow = lowestLow(bars, Math.max(0, i - 25), Math.max(0, i - 1));
      const isNewLow = currentBar.low <= lookbackLow || i <= scBarIndex + 5;
      const isClimaxVolume =
        (volRatio20 >= 1.65 && spreadRatio20 >= 1.25) ||
        (volRatio20 >= 1.8 && closePosition >= 0.30);

      if (isNewLow && isClimaxVolume) {
        scBarIndex = i;
        scLow = currentBar.low;
        supportPrice = currentBar.low;
        scVolRatio = volRatio20;
        tradingRangeStartBar = i;
        tradingRangeStartTime = currentBar.time;
        phase = 'PHASE_A';
        phaseStep = 'SC_FOUND';

        if (i - lastMarkerBarIndex >= 3) {
          markers.push({
            time: currentBar.time,
            barIndex: i,
            phase: 'PHASE_A',
            tag: 'SC',
            price: currentBar.low,
            position: 'belowBar',
            shape: 'arrowUp',
            color: '#E11D48',
            label: 'SC',
            plainEnglishStory: `Selling Climax (SC) at ${currentBar.low.toFixed(2)}: Panic public selling absorbed by institutional smart money on ${volRatio20.toFixed(1)}x volume. Trading range floor established.`,
          });
          lastMarkerBarIndex = i;
        }
      }
    }

    // Deeper panic low shifting before AR
    if (phaseStep === 'SC_FOUND' && i <= scBarIndex + 6 && currentBar.low < scLow) {
      scBarIndex = i;
      scLow = currentBar.low;
      supportPrice = currentBar.low;
      scVolRatio = Math.max(scVolRatio, volRatio20);
    }

    // Automatic Rally (AR)
    if (phaseStep === 'SC_FOUND' && i >= scBarIndex + 3 && i <= scBarIndex + 22) {
      const highestSinceSc = highestHigh(bars, scBarIndex + 1, i);
      const rallyHeightAtr = (highestSinceSc - scLow) / atr20;
      const isPullingBack =
        currentBar.close < currentBar.open ||
        currentBar.high < (bars[i - 1]?.high ?? currentBar.high);

      if (rallyHeightAtr >= 1.8 && isPullingBack) {
        arHigh = highestSinceSc;
        resistancePrice = arHigh;
        arBarIndex = i;
        phaseStep = 'AR_FOUND';

        if (i - lastMarkerBarIndex >= 3) {
          markers.push({
            time: currentBar.time,
            barIndex: i,
            phase: 'PHASE_A',
            tag: 'AR',
            price: arHigh,
            position: 'aboveBar',
            shape: 'arrowDown',
            color: '#0D9488',
            label: 'AR',
            plainEnglishStory: `Automatic Rally (AR) to ${arHigh.toFixed(2)}: Sharp +${((arHigh - scLow) / scLow * 100).toFixed(1)}% bounce on short covering establishes Trading Range ceiling.`,
          });
          lastMarkerBarIndex = i;
        }
      }
    }

    // Secondary Test (ST)
    if (phaseStep === 'AR_FOUND' && i >= arBarIndex + 2) {
      const trHeight = Math.max(resistancePrice - supportPrice, atr20);
      const isRetestingSupport =
        currentBar.low <= supportPrice + 0.35 * trHeight &&
        currentBar.low >= supportPrice - 0.50 * atr20;
      const isSwingLowTurn = currentBar.close > currentBar.open || closePosition >= 0.50;
      const isDryVolume = volRatio20 < scVolRatio * 0.95;

      if (isRetestingSupport && isSwingLowTurn && isDryVolume) {
        stBarIndex = i;
        stLow = currentBar.low;
        supportPrice = Math.min(scLow, currentBar.low);
        phase = 'PHASE_B';
        phaseStep = 'IN_PHASE_B';
        barsInPhaseB = 0;
        upthrustCount = 0;
        phaseBDownVolumeSum = 0;
        phaseBDownBarsCount = 0;
        phaseBUpVolumeSum = 0;
        phaseBUpBarsCount = 0;

        if (i - lastMarkerBarIndex >= 3) {
          markers.push({
            time: currentBar.time,
            barIndex: i,
            phase: 'PHASE_A',
            tag: 'ST',
            price: currentBar.low,
            position: 'belowBar',
            shape: 'circle',
            color: '#2563EB',
            label: 'ST',
            plainEnglishStory: `Secondary Test (ST) at ${currentBar.low.toFixed(2)}: Retest of support holds on contracting volume (${volRatio20.toFixed(1)}x), confirming supply absorption. Entering Phase B.`,
          });
          lastMarkerBarIndex = i;
        }
      }
    }

    // -------------------------------------------------------------------------
    // 3. Strict Phase B (Building the Cause & Supply Absorption)
    // -------------------------------------------------------------------------
    if (phase === 'PHASE_B') {
      barsInPhaseB += 1;
      const trHeight = Math.max(resistancePrice - supportPrice, atr20);

      // Track volume absorption
      if (currentBar.close < currentBar.open) {
        phaseBDownVolumeSum += currentBar.volume;
        phaseBDownBarsCount += 1;
      } else {
        phaseBUpVolumeSum += currentBar.volume;
        phaseBUpBarsCount += 1;
      }

      // Catastrophic breakdown reset
      if (currentBar.close < supportPrice - 1.6 * atr20) {
        consecutiveBreakdownCloses += 1;
        if (consecutiveBreakdownCloses >= 2) {
          phase = 'NONE';
          phaseStep = 'NONE';
          consecutiveBreakdownCloses = 0;
          if (inTrade) {
            orderIntent = {
              action: 'EXIT_LONG',
              allocationPct: 0,
              stopLossPrice: null,
              takeProfitPrice: null,
              reason: 'Catastrophic Trading Range Breakdown: Support invalidated',
              phaseLabel: 'NONE',
            };
            inTrade = false;
            lastExitBarIndex = i;
          }
        }
      } else {
        consecutiveBreakdownCloses = 0;
      }

      // Upthrust (UT)
      if (
        upthrustCount < 2 &&
        currentBar.high > resistancePrice + 0.15 * atr20 &&
        currentBar.close < resistancePrice &&
        i - lastMarkerBarIndex >= 3
      ) {
        markers.push({
          time: currentBar.time,
          barIndex: i,
          phase: 'PHASE_B',
          tag: 'UT',
          price: currentBar.high,
          position: 'aboveBar',
          shape: 'square',
          color: '#D97706',
          label: 'UT',
          plainEnglishStory: `Upthrust (UT) at ${currentBar.high.toFixed(2)}: False breakout above resistance tests overhead supply and falls back into the Trading Range.`,
        });
        upthrustCount += 1;
        lastMarkerBarIndex = i;
      }

      // Phase C Trigger Readiness
      const minCauseBars = riskPosture === 'AGGRESSIVE' ? 6 : riskPosture === 'BALANCED' ? 10 : 14;

      if (barsInPhaseB >= minCauseBars) {
        // Path A: Schematic #1 Spring (Bear Trap below support)
        const isPiercingSupport =
          currentBar.low < supportPrice - 0.05 * atr20 &&
          currentBar.low >= supportPrice - 1.40 * atr20;
        const isSpringReclaim =
          currentBar.close >= supportPrice &&
          closePosition >= 0.52 &&
          volRatio20 <= 1.70;

        if (isPiercingSupport && isSpringReclaim) {
          springBarIndex = i;
          springLowPrice = currentBar.low;
          schematicType = 'SCHEMATIC_1_SPRING';
          phase = 'PHASE_D';
          phaseStep = 'SPRING_FOUND';

          if (i - lastMarkerBarIndex >= 3) {
            markers.push({
              time: currentBar.time,
              barIndex: i,
              phase: 'PHASE_C',
              tag: 'SPRING',
              price: currentBar.low,
              position: 'belowBar',
              shape: 'arrowUp',
              color: '#0D9488',
              label: 'SPRING',
              plainEnglishStory: `Spring (Schematic #1) at ${currentBar.low.toFixed(2)}: Shakeout beneath ${supportPrice.toFixed(2)} support traps late shorts. Strong close above support triggers Phase C accumulation entry.`,
            });
            markers.push({
              time: currentBar.time,
              barIndex: i,
              phase: 'PHASE_C',
              tag: 'ENTRY',
              price: currentBar.close,
              position: 'belowBar',
              shape: 'arrowUp',
              color: '#0D9488',
              label: 'BUY',
              plainEnglishStory: `Phase C Entry: Long position initiated at ${currentBar.close.toFixed(2)} on Schematic #1 Spring reclaim.`,
            });
            lastMarkerBarIndex = i;
          }

          const sl = currentBar.low - 1.0 * atr20;
          orderIntent = {
            action: 'ENTER_LONG',
            allocationPct: riskPosture === 'CONSERVATIVE' ? 0.50 : riskPosture === 'BALANCED' ? 0.65 : 0.80,
            stopLossPrice: sl,
            takeProfitPrice: resistancePrice + 2.0 * atr20,
            reason: 'Wyckoff Schematic #1 Spring: Bear trap below support reclaimed on dry absorption volume',
            phaseLabel: 'PHASE_C',
          };
          inTrade = true;
          entryPrice = currentBar.close;
          trailingStopPrice = sl;
        }

        // Path B: Schematic #2 Higher-Low LPS (Without a Spring)
        const prevBar = bars[i - 1] ?? currentBar;
        const inLowerMidTr =
          currentBar.low > supportPrice + 0.04 * trHeight &&
          currentBar.low <= supportPrice + 0.55 * trHeight;

        // Rolling 3-bar volume dry up
        const b1 = bars[i - 1]?.volume ?? currentBar.volume;
        const b2 = bars[i - 2]?.volume ?? currentBar.volume;
        const v3Avg = (currentBar.volume + b1 + b2) / 3;
        const avg20Vol =
          bars.slice(Math.max(0, i - 19), i + 1).reduce((s, b) => s + b.volume, 0) / 20;
        const isVolumeDryUp = v3Avg <= 0.88 * avg20Vol || volRatio20 <= 0.85;

        // Bullish Demand Reversal Bar
        const isDemandReversal =
          currentBar.close > currentBar.open &&
          closePosition >= 0.60 &&
          currentBar.close > prevBar.high;

        if (!isPiercingSupport && inLowerMidTr && isVolumeDryUp && isDemandReversal) {
          schematicType = 'SCHEMATIC_2_HIGHER_LOW';
          phase = 'PHASE_D';
          phaseStep = 'LPS_FOUND';

          if (i - lastMarkerBarIndex >= 3) {
            markers.push({
              time: currentBar.time,
              barIndex: i,
              phase: 'PHASE_C',
              tag: 'LPS',
              price: currentBar.low,
              position: 'belowBar',
              shape: 'arrowUp',
              color: '#0D9488',
              label: 'LPS #2',
              plainEnglishStory: `Last Point of Support (Schematic #2) at ${currentBar.low.toFixed(2)}: High-demand test holds well above support on dry volume (${volRatio20.toFixed(1)}x), confirming supply exhaustion.`,
            });
            markers.push({
              time: currentBar.time,
              barIndex: i,
              phase: 'PHASE_C',
              tag: 'ENTRY',
              price: currentBar.close,
              position: 'belowBar',
              shape: 'arrowUp',
              color: '#0D9488',
              label: 'BUY',
              plainEnglishStory: `Phase C Entry: Long position initiated at ${currentBar.close.toFixed(2)} on Schematic #2 Higher-Low LPS.`,
            });
            lastMarkerBarIndex = i;
          }

          const sl = Math.min(supportPrice - 0.4 * atr20, currentBar.low - 1.1 * atr20);
          orderIntent = {
            action: 'ENTER_LONG',
            allocationPct: riskPosture === 'CONSERVATIVE' ? 0.55 : riskPosture === 'BALANCED' ? 0.70 : 0.85,
            stopLossPrice: sl,
            takeProfitPrice: resistancePrice + 2.0 * atr20,
            reason: 'Wyckoff Schematic #2 LPS: Higher-low test with volume dry-up and demand reversal',
            phaseLabel: 'PHASE_C',
          };
          inTrade = true;
          entryPrice = currentBar.close;
          trailingStopPrice = sl;
        }
      }
    }

    // -------------------------------------------------------------------------
    // 4. Strict Phase D (SOS & LPS Scale-In)
    // -------------------------------------------------------------------------
    if (phase === 'PHASE_D') {
      const trHeight = Math.max(resistancePrice - supportPrice, atr20);

      // Sign of Strength (SOS)
      if (
        phaseStep !== 'SOS_FOUND' &&
        (currentBar.close >= resistancePrice - 0.35 * trHeight || currentBar.close > resistancePrice) &&
        spreadRatio20 >= 1.10 &&
        volRatio20 >= 1.10 &&
        closePosition >= 0.62
      ) {
        phaseStep = 'SOS_FOUND';
        lastSosBarIndex = i;

        if (i - lastMarkerBarIndex >= 3) {
          markers.push({
            time: currentBar.time,
            barIndex: i,
            phase: 'PHASE_D',
            tag: 'SOS',
            price: currentBar.high,
            position: 'aboveBar',
            shape: 'arrowUp',
            color: '#0D9488',
            label: 'SOS',
            plainEnglishStory: `Sign of Strength (SOS) at ${currentBar.high.toFixed(2)}: Decisive institutional markup on expanding volume (${volRatio20.toFixed(1)}x) pushes toward range boundary.`,
          });
          lastMarkerBarIndex = i;
        }
      }

      // Phase D LPS Scale-In
      const prevBar = bars[i - 1] ?? currentBar;
      if (
        phaseStep === 'SOS_FOUND' &&
        i >= lastSosBarIndex + 2 &&
        i <= lastSosBarIndex + 10 &&
        volRatio20 <= 0.95 &&
        currentBar.low >= supportPrice + 0.45 * trHeight &&
        currentBar.close > prevBar.high
      ) {
        if (i - lastMarkerBarIndex >= 3) {
          markers.push({
            time: currentBar.time,
            barIndex: i,
            phase: 'PHASE_D',
            tag: 'LPS',
            price: currentBar.low,
            position: 'belowBar',
            shape: 'circle',
            color: '#2563EB',
            label: 'LPS',
            plainEnglishStory: `Phase D LPS at ${currentBar.low.toFixed(2)}: Shallow pullback holds above Trading Range midpoint on drying volume. Scaling in.`,
          });
          markers.push({
            time: currentBar.time,
            barIndex: i,
            phase: 'PHASE_D',
            tag: 'ENTRY',
            price: currentBar.close,
            position: 'belowBar',
            shape: 'arrowUp',
            color: '#0D9488',
            label: inTrade ? 'ADD' : 'BUY',
            plainEnglishStory: inTrade
              ? `Phase D Scale-In: Added to long position at ${currentBar.close.toFixed(2)}.`
              : `Phase D Entry: Initiated long position at ${currentBar.close.toFixed(2)}.`,
          });
          lastMarkerBarIndex = i;
        }

        const sl = currentBar.low - 0.9 * atr20;
        trailingStopPrice = Math.max(trailingStopPrice, sl);

        if (inTrade) {
          orderIntent = {
            action: 'ADD_LONG',
            allocationPct: 0.95,
            stopLossPrice: trailingStopPrice,
            takeProfitPrice: null,
            reason: 'Phase D LPS Scale-in: Pullback holds above TR midpoint on contracting volume',
            phaseLabel: 'PHASE_D',
          };
        } else {
          inTrade = true;
          entryPrice = currentBar.close;
          orderIntent = {
            action: 'ENTER_LONG',
            allocationPct: 0.75,
            stopLossPrice: trailingStopPrice,
            takeProfitPrice: null,
            reason: 'Phase D LPS Entry: Pullback holds above TR midpoint on contracting volume',
            phaseLabel: 'PHASE_D',
          };
        }
      }

      // Breakout to Phase E
      if (currentBar.close > resistancePrice + 0.25 * atr20) {
        phase = 'PHASE_E';
        phaseStep = 'PHASE_E_MARKUP';
        highestHighSinceBreakout = currentBar.high;
        trailingStopPrice = Math.max(trailingStopPrice, currentBar.high - 2.6 * atr20);
      }
    }

    // -------------------------------------------------------------------------
    // 5. Strict Phase E (Open-Market Markup Trend & Chandelier Trailing Exit)
    // -------------------------------------------------------------------------
    if (phase === 'PHASE_E') {
      highestHighSinceBreakout = Math.max(highestHighSinceBreakout, currentBar.high);

      // Chandelier Exit trailing stop
      const newTrailingStop = highestHighSinceBreakout - 2.6 * atr20;
      trailingStopPrice = Math.max(trailingStopPrice, newTrailingStop);

      // Back-Up (BU) marker on first shallow retest
      if (
        !buRetestLogged &&
        currentBar.low <= resistancePrice + 0.15 * atr20 &&
        currentBar.close >= resistancePrice &&
        i - lastMarkerBarIndex >= 3
      ) {
        markers.push({
          time: currentBar.time,
          barIndex: i,
          phase: 'PHASE_E',
          tag: 'BU',
          price: currentBar.low,
          position: 'belowBar',
          shape: 'arrowUp',
          color: '#2563EB',
          label: 'BU',
          plainEnglishStory: `Back Up (BU) at ${currentBar.low.toFixed(2)}: Orderly retest treats prior resistance (${resistancePrice.toFixed(2)}) as new support. Markup confirmed.`,
        });
        buRetestLogged = true;
        lastMarkerBarIndex = i;
      }

      // Chandelier Trailing Exit
      if (inTrade && currentBar.close < trailingStopPrice) {
        orderIntent = {
          action: 'EXIT_LONG',
          allocationPct: 0,
          stopLossPrice: null,
          takeProfitPrice: null,
          reason: 'Phase E Chandelier Trailing Stop triggered; locking in markup trend alpha',
          phaseLabel: 'PHASE_E',
        };
        inTrade = false;
        phase = 'NONE';
        phaseStep = 'NONE';
        lastExitBarIndex = i;

        if (i - lastMarkerBarIndex >= 3) {
          markers.push({
            time: currentBar.time,
            barIndex: i,
            phase: 'PHASE_E',
            tag: 'EXIT',
            price: currentBar.close,
            position: 'aboveBar',
            shape: 'arrowDown',
            color: '#E11D48',
            label: 'EXIT',
            plainEnglishStory: `Macro Trend Exit at ${currentBar.close.toFixed(2)}: Chandelier stop crossed; locking in gains and resetting for next accumulation cycle.`,
          });
          lastMarkerBarIndex = i;
        }
      }
    }

    // Active Trading Range Box Annotation
    if (supportPrice > 0 && resistancePrice > supportPrice && phase !== 'NONE') {
      activeZone = {
        id: `tr-${tradingRangeStartBar}`,
        startTime: tradingRangeStartTime,
        endTime: currentBar.time,
        supportPrice,
        resistancePrice,
        label: `Wyckoff TR [${supportPrice.toFixed(2)} - ${resistancePrice.toFixed(2)}]`,
      };
    }

    const nextState: WyckoffState = {
      phase,
      phaseStep,
      tradingRangeStartBar,
      tradingRangeStartTime,
      supportPrice,
      resistancePrice,
      scBarIndex,
      scLow,
      scVolRatio,
      arBarIndex,
      arHigh,
      stBarIndex,
      stLow,
      springBarIndex,
      springLowPrice,
      schematicType,
      barsInPhaseB,
      upthrustCount,
      phaseBDownVolumeSum,
      phaseBDownBarsCount,
      phaseBUpVolumeSum,
      phaseBUpBarsCount,
      inTrade,
      entryPrice,
      trailingStopPrice,
      highestHighSinceBreakout,
      lastMarkerBarIndex,
      lastExitBarIndex,
      consecutiveBreakdownCloses,
      lastSosBarIndex,
      buRetestLogged,
    };

    return {
      nextState,
      output: { orderIntent, markers, activeZone },
    };
  },
};
