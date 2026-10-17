import type {
  ChartMarkerAnnotation,
  HorizontalZoneAnnotation,
  OHLCVBar,
  WyckoffPhaseId,
} from '../types/market';
import type {
  IStrategy,
  OrderAction,
  StrategyContext,
  StrategyParameterMap,
  StrategyParameterSchema,
  StrategyStepOutput,
} from '../types/strategy';
import {
  computeATR,
  computeSpreadRatio,
  computeVolumeRatio,
  lowestLow,
} from '../utils/indicators';

export interface WyckoffInternalState {
  readonly currentPhase: WyckoffPhaseId;
  readonly psDetected: boolean;
  readonly psIndex: number | null;
  readonly psPrice: number | null;
  readonly scDetected: boolean;
  readonly scIndex: number | null;
  readonly scTime: number | null;
  readonly supportPrice: number;
  readonly scSpread: number;
  readonly scVolume: number;
  readonly arDetected: boolean;
  readonly arIndex: number | null;
  readonly resistancePrice: number;
  readonly candidateArHigh: number;
  readonly candidateArIndex: number | null;
  readonly stDetected: boolean;
  readonly stIndex: number | null;
  readonly phaseBStartBar: number | null;
  readonly phaseBBarsCount: number;
  readonly utDetected: boolean;
  readonly springDetected: boolean;
  readonly phaseCLpsCandidate: {
    readonly low: number;
    readonly index: number;
    readonly high: number;
  } | null;
  readonly phaseCLpsDetected: boolean;
  readonly phaseCCompleted: boolean;
  readonly sosDetected: boolean;
  readonly sosIndex: number | null;
  readonly sosHigh: number;
  readonly phaseDLpsCandidate: {
    readonly low: number;
    readonly index: number;
    readonly high: number;
  } | null;
  readonly phaseDLpsDetected: boolean;
  readonly scaledIn: boolean;
  readonly buDetected: boolean;
  readonly currentTrailingStop: number | null;
}

const WYCKOFF_PARAMETERS: readonly StrategyParameterSchema[] = [
  {
    key: 'schematicMode',
    label: 'Schematic Mode',
    description: 'Trading schematic variant: BOTH, SCHEMATIC_1_ONLY (Spring), or SCHEMATIC_2_ONLY (Higher-Low LPS)',
    type: 'select',
    defaultValue: 'BOTH',
    options: [
      { label: 'Both Schematics (#1 & #2)', value: 'BOTH' },
      { label: 'Schematic #1 Only (Spring)', value: 'SCHEMATIC_1_ONLY' },
      { label: 'Schematic #2 Only (Higher-Low LPS)', value: 'SCHEMATIC_2_ONLY' },
    ],
  },
  {
    key: 'scVolumeMultiplier',
    label: 'SC Volume Multiplier',
    description: 'Volume multiplier threshold relative to 20-bar baseline for Selling Climax detection',
    type: 'number',
    defaultValue: 1.75,
    min: 1.2,
    max: 3.0,
    step: 0.05,
  },
  {
    key: 'minPhaseBBars',
    label: 'Min Phase B Bars',
    description: 'Minimum duration in bars of trading range consolidation in Phase B before Phase C activation',
    type: 'number',
    defaultValue: 12,
    min: 6,
    max: 40,
    step: 1,
  },
  {
    key: 'lpsMaxVolRatio',
    label: 'LPS Max Volume Ratio',
    description: 'Maximum volume ratio allowed on Last Point of Support pullbacks in Phase C and D',
    type: 'number',
    defaultValue: 0.95,
    min: 0.5,
    max: 1.3,
    step: 0.05,
  },
  {
    key: 'atrStopMultiplier',
    label: 'ATR Stop Multiplier',
    description: 'Multiplier for dynamic ATR trailing stop-loss during Phase E markup',
    type: 'number',
    defaultValue: 2.0,
    min: 1.0,
    max: 4.0,
    step: 0.25,
  },
  {
    key: 'pyramidingEnabled',
    label: 'Pyramiding Enabled',
    description: 'Enable scale-in pyramiding on Phase D LPS confirmation',
    type: 'boolean',
    defaultValue: true,
  },
];

function initWyckoffState(_parameters: StrategyParameterMap): WyckoffInternalState {
  return {
    currentPhase: 'NONE',
    psDetected: false,
    psIndex: null,
    psPrice: null,
    scDetected: false,
    scIndex: null,
    scTime: null,
    supportPrice: 0,
    scSpread: 0,
    scVolume: 0,
    arDetected: false,
    arIndex: null,
    resistancePrice: 0,
    candidateArHigh: 0,
    candidateArIndex: null,
    stDetected: false,
    stIndex: null,
    phaseBStartBar: null,
    phaseBBarsCount: 0,
    utDetected: false,
    springDetected: false,
    phaseCLpsCandidate: null,
    phaseCLpsDetected: false,
    phaseCCompleted: false,
    sosDetected: false,
    sosIndex: null,
    sosHigh: 0,
    phaseDLpsCandidate: null,
    phaseDLpsDetected: false,
    scaledIn: false,
    buDetected: false,
    currentTrailingStop: null,
  };
}

function evaluateWyckoffBar(
  context: StrategyContext,
  state: WyckoffInternalState
): { readonly nextState: WyckoffInternalState; readonly output: StrategyStepOutput } {
  const params = context.parameters;
  const schematicModeParam = params.schematicMode;
  const schematicMode = typeof schematicModeParam === 'string' ? schematicModeParam : 'BOTH';

  const scVolParam = params.scVolumeMultiplier;
  const scVolumeMultiplier = typeof scVolParam === 'number' ? scVolParam : 1.75;

  const minPhaseBParam = params.minPhaseBBars;
  const minPhaseBBars = typeof minPhaseBParam === 'number' ? minPhaseBParam : 12;

  const lpsMaxVolParam = params.lpsMaxVolRatio;
  const lpsMaxVolRatio = typeof lpsMaxVolParam === 'number' ? lpsMaxVolParam : 0.95;

  const atrStopParam = params.atrStopMultiplier;
  const atrStopMultiplier = typeof atrStopParam === 'number' ? atrStopParam : 2.0;

  const pyramidingParam = params.pyramidingEnabled;
  const pyramidingEnabled = typeof pyramidingParam === 'boolean' ? pyramidingParam : true;

  const currentBar = context.currentBar;
  const i = context.currentIndex;
  const bars = context.bars;
  const atr = computeATR(bars, 14);
  const volRatio = computeVolumeRatio(bars, 20);
  const spreadRatio = computeSpreadRatio(bars, 20);

  let nextPhase: WyckoffPhaseId = state.currentPhase;
  let psDetected = state.psDetected;
  let psIndex = state.psIndex;
  let psPrice = state.psPrice;
  let scDetected = state.scDetected;
  let scIndex = state.scIndex;
  let scTime = state.scTime;
  let supportPrice = state.supportPrice;
  let scSpread = state.scSpread;
  let scVolume = state.scVolume;
  let arDetected = state.arDetected;
  let arIndex = state.arIndex;
  let resistancePrice = state.resistancePrice;
  let candidateArHigh = state.candidateArHigh;
  let candidateArIndex = state.candidateArIndex;
  let stDetected = state.stDetected;
  let stIndex = state.stIndex;
  let phaseBStartBar = state.phaseBStartBar;
  let phaseBBarsCount = state.phaseBBarsCount;
  let utDetected = state.utDetected;
  let springDetected = state.springDetected;
  let phaseCLpsCandidate = state.phaseCLpsCandidate;
  let phaseCLpsDetected = state.phaseCLpsDetected;
  let phaseCCompleted = state.phaseCCompleted;
  let sosDetected = state.sosDetected;
  let sosIndex = state.sosIndex;
  let sosHigh = state.sosHigh;
  let phaseDLpsCandidate = state.phaseDLpsCandidate;
  let phaseDLpsDetected = state.phaseDLpsDetected;
  let scaledIn = state.scaledIn;
  let buDetected = state.buDetected;
  let currentTrailingStop = state.currentTrailingStop;

  const markers: ChartMarkerAnnotation[] = [];
  let orderAction: OrderAction = 'HOLD';
  let allocationPct = 0;
  let stopLossPrice: number | null = currentTrailingStop;
  let reason = 'Holding phase state';

  const prevBar: OHLCVBar | undefined = i > 0 ? bars[i - 1] : undefined;

  // 1. PHASE A: Preliminary Support (PS) and Selling Climax (SC)
  if (!scDetected) {
    if (!psDetected && i >= 10) {
      const priorLow = lowestLow(bars, 10, 1);
      if (volRatio >= 1.35 && currentBar.close < priorLow) {
        psDetected = true;
        psIndex = i;
        psPrice = currentBar.low;
        nextPhase = 'PHASE_A';
        markers.push({
          time: currentBar.time,
          barIndex: i,
          phase: 'PHASE_A',
          tag: 'PS',
          price: currentBar.low,
          position: 'belowBar',
          shape: 'circle',
          color: '#0F172A',
          label: 'PS',
          rationale: `Preliminary Support: high-volume drop at ${currentBar.low.toFixed(2)}`,
        });
      }
    }

    const currentSpread = currentBar.high - currentBar.low;
    const closeOffLowPct = currentSpread > 1e-6 ? (currentBar.close - currentBar.low) / currentSpread : 0;
    if (volRatio >= scVolumeMultiplier && spreadRatio >= 1.3 && closeOffLowPct >= 0.25) {
      scDetected = true;
      scIndex = i;
      scTime = currentBar.time;
      supportPrice = currentBar.low;
      scSpread = currentSpread;
      scVolume = currentBar.volume;
      nextPhase = 'PHASE_A';
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
        rationale: `Selling Climax: capitulation volume at ${currentBar.low.toFixed(2)} setting TR support`,
      });
    }
  } else if (!arDetected) {
    // 2. PHASE A: Automatic Rally (AR)
    if (currentBar.high > candidateArHigh) {
      candidateArHigh = currentBar.high;
      candidateArIndex = i;
    }
    const rallyRange = candidateArHigh - supportPrice;
    if (rallyRange >= 1.8 * atr && candidateArIndex !== null && i >= candidateArIndex + 1) {
      const priorClose = prevBar ? prevBar.close : currentBar.open;
      if (currentBar.close < priorClose) {
        arDetected = true;
        arIndex = candidateArIndex;
        resistancePrice = candidateArHigh;
        const arBar = bars[candidateArIndex];
        if (arBar) {
          markers.push({
            time: arBar.time,
            barIndex: candidateArIndex,
            phase: 'PHASE_A',
            tag: 'AR',
            price: candidateArHigh,
            position: 'aboveBar',
            shape: 'circle',
            color: '#0D9488',
            label: 'AR',
            rationale: `Automatic Rally: peak at ${candidateArHigh.toFixed(2)} setting TR resistance`,
          });
        }
      }
    }
  } else if (!stDetected) {
    // 3. PHASE A: Secondary Test (ST)
    const nearSupport = currentBar.low <= supportPrice + 0.85 * atr && currentBar.low >= supportPrice - 0.60 * atr;
    const lowerSupply = spreadRatio < 1.0 && volRatio < 1.0;
    if (nearSupport && lowerSupply) {
      stDetected = true;
      stIndex = i;
      nextPhase = 'PHASE_B';
      phaseBStartBar = i;
      phaseBBarsCount = 0;
      markers.push({
        time: currentBar.time,
        barIndex: i,
        phase: 'PHASE_A',
        tag: 'ST',
        price: currentBar.low,
        position: 'belowBar',
        shape: 'circle',
        color: '#D97706',
        label: 'ST',
        rationale: `Secondary Test: test of support at ${currentBar.low.toFixed(2)} with reduced volume`,
      });
    }
  } else if (nextPhase === 'PHASE_B') {
    // 4. PHASE B: Building a Cause
    phaseBBarsCount += 1;

    // Upthrust (UT)
    if (!utDetected && currentBar.high > resistancePrice && currentBar.close <= resistancePrice + 0.1 * atr) {
      utDetected = true;
      markers.push({
        time: currentBar.time,
        barIndex: i,
        phase: 'PHASE_B',
        tag: 'UT',
        price: currentBar.high,
        position: 'aboveBar',
        shape: 'arrowDown',
        color: '#D97706',
        label: 'UT',
        rationale: `Upthrust in Phase B: brief poke to ${currentBar.high.toFixed(2)} above TR resistance`,
      });
    }

    const trMid = supportPrice + 0.5 * (resistancePrice - supportPrice);
    if (phaseBBarsCount >= minPhaseBBars) {
      const isSupplyDrying = (currentBar.volume <= 0.20 * scVolume || volRatio <= 0.80) && currentBar.low <= trMid;
      if (currentBar.low < supportPrice || isSupplyDrying) {
        nextPhase = 'PHASE_C';
      }
    }
  }

  // 5. PHASE C: Supply Testing (Schematic #1 Spring & Schematic #2 Higher-Low LPS)
  if (nextPhase === 'PHASE_C' && !phaseCCompleted) {
    const trMid = supportPrice + 0.5 * (resistancePrice - supportPrice);

    // Schematic #1: Spring
    const allowSchematic1 = schematicMode === 'BOTH' || schematicMode === 'SCHEMATIC_1_ONLY';
    const isSpring =
      currentBar.low < supportPrice &&
      supportPrice - currentBar.low <= 1.5 * atr &&
      currentBar.close >= supportPrice - 0.20 * atr &&
      volRatio <= 1.6;

    if (allowSchematic1 && isSpring && !springDetected) {
      springDetected = true;
      phaseCCompleted = true;
      nextPhase = 'PHASE_D';
      orderAction = 'ENTER_LONG';
      allocationPct = 0.55;
      stopLossPrice = currentBar.low - 0.5 * atr;
      currentTrailingStop = stopLossPrice;
      reason = 'Wyckoff Schematic #1: Phase C Spring entry below TR support';

      markers.push({
        time: currentBar.time,
        barIndex: i,
        phase: 'PHASE_C',
        tag: 'SPRING',
        price: currentBar.low,
        position: 'belowBar',
        shape: 'arrowUp',
        color: '#2563EB',
        label: 'SPRING',
        rationale: `Phase C Spring: shakeout at ${currentBar.low.toFixed(2)} with swift demand recovery`,
      });
    }

    // Schematic #2: Higher-Low LPS without Spring
    const allowSchematic2 = schematicMode === 'BOTH' || schematicMode === 'SCHEMATIC_2_ONLY';
    if (allowSchematic2 && !phaseCCompleted && !springDetected) {
      const isHigherLowTest =
        currentBar.low > supportPrice &&
        currentBar.low <= trMid &&
        spreadRatio <= 0.95 &&
        volRatio <= lpsMaxVolRatio;

      if (isHigherLowTest) {
        phaseCLpsCandidate = { low: currentBar.low, index: i, high: currentBar.high };
      } else if (phaseCLpsCandidate !== null && i === phaseCLpsCandidate.index + 1) {
        const isBullishDemand = currentBar.close > currentBar.open && currentBar.close > phaseCLpsCandidate.high;
        if (isBullishDemand) {
          phaseCLpsDetected = true;
          phaseCCompleted = true;
          nextPhase = 'PHASE_D';
          orderAction = 'ENTER_LONG';
          allocationPct = 0.60;
          stopLossPrice = supportPrice - 0.5 * atr;
          currentTrailingStop = stopLossPrice;
          reason = 'Wyckoff Schematic #2: Phase C Higher-Low LPS entry';

          markers.push({
            time: currentBar.time,
            barIndex: i,
            phase: 'PHASE_C',
            tag: 'LPS',
            price: currentBar.low,
            position: 'belowBar',
            shape: 'arrowUp',
            color: '#0D9488',
            label: 'LPS',
            rationale: `Phase C Higher-Low Test: dry volume test held at ${phaseCLpsCandidate.low.toFixed(2)} confirmed by demand bar`,
          });
        }
      }
    }
  }

  // 6. PHASE D: Sign of Strength (SOS) & Last Point of Support (LPS) Scale-In
  if (nextPhase === 'PHASE_D') {
    if (!sosDetected) {
      const bullishAdvance = currentBar.close > currentBar.open && (spreadRatio >= 1.15 || volRatio >= 1.20);
      const reachingUpperOrAbove = currentBar.high >= resistancePrice || currentBar.close >= resistancePrice - 0.25 * atr;
      if (bullishAdvance && reachingUpperOrAbove) {
        sosDetected = true;
        sosIndex = i;
        sosHigh = currentBar.high;
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
          rationale: `Sign of Strength: demand expansion to ${currentBar.high.toFixed(2)} breaking toward resistance`,
        });
      }
    } else if (!phaseDLpsDetected) {
      const minHoldingLevel = supportPrice + 0.25 * (resistancePrice - supportPrice);
      const isQuietReaction =
        currentBar.low >= minHoldingLevel &&
        spreadRatio <= 0.95 &&
        volRatio <= lpsMaxVolRatio;

      if (isQuietReaction) {
        phaseDLpsCandidate = { low: currentBar.low, index: i, high: currentBar.high };
      } else if (phaseDLpsCandidate !== null && i >= phaseDLpsCandidate.index + 1 && i <= phaseDLpsCandidate.index + 3) {
        if (currentBar.close > currentBar.open && currentBar.close > phaseDLpsCandidate.high) {
          phaseDLpsDetected = true;
          const newStop = phaseDLpsCandidate.low - 0.2 * atr;
          currentTrailingStop = Math.max(currentTrailingStop ?? 0, newStop);
          stopLossPrice = currentTrailingStop;

          markers.push({
            time: currentBar.time,
            barIndex: i,
            phase: 'PHASE_D',
            tag: 'LPS',
            price: currentBar.low,
            position: 'belowBar',
            shape: 'arrowUp',
            color: '#0D9488',
            label: 'LPS',
            rationale: `Phase D LPS: pullback held at ${phaseDLpsCandidate.low.toFixed(2)} confirmed by demand expansion`,
          });

          if (context.openPosition === null) {
            orderAction = 'ENTER_LONG';
            allocationPct = 0.60;
            reason = 'Phase D LPS entry';
          } else if (pyramidingEnabled && !scaledIn) {
            orderAction = 'ADD_LONG';
            allocationPct = 0.35;
            scaledIn = true;
            reason = 'Phase D LPS scale-in pyramiding';
          }
        }
      }
    } else {
      if (currentBar.close > resistancePrice + 0.35 * atr) {
        nextPhase = 'PHASE_E';
        buDetected = true;
        markers.push({
          time: currentBar.time,
          barIndex: i,
          phase: 'PHASE_E',
          tag: 'BU',
          price: currentBar.close,
          position: 'aboveBar',
          shape: 'arrowUp',
          color: '#0D9488',
          label: 'BU',
          rationale: `Phase E Back-Up / Breakout: decisive close at ${currentBar.close.toFixed(2)} above TR`,
        });
        const phaseEStop = currentBar.close - atrStopMultiplier * atr;
        currentTrailingStop = Math.max(currentTrailingStop ?? 0, phaseEStop);
        stopLossPrice = currentTrailingStop;
      }
    }
  }

  // 7. PHASE E: Markup & Dynamic Trailing Stop
  if (nextPhase === 'PHASE_E') {
    const candidateStop = currentBar.close - atrStopMultiplier * atr;
    currentTrailingStop = Math.max(currentTrailingStop ?? 0, candidateStop);
    stopLossPrice = currentTrailingStop;
  }

  let activeZone: HorizontalZoneAnnotation | null = null;
  if (scDetected && scTime !== null && supportPrice > 0) {
    activeZone = {
      id: 'wyckoff-accumulation-tr',
      startTime: scTime,
      endTime: currentBar.time,
      supportPrice,
      resistancePrice: resistancePrice > 0 ? resistancePrice : currentBar.high,
      label: `Wyckoff TR: [${supportPrice.toFixed(2)} - ${(resistancePrice > 0 ? resistancePrice : currentBar.high).toFixed(2)}]`,
    };
  }

  const nextState: WyckoffInternalState = {
    currentPhase: nextPhase,
    psDetected,
    psIndex,
    psPrice,
    scDetected,
    scIndex,
    scTime,
    supportPrice,
    scSpread,
    scVolume,
    arDetected,
    arIndex,
    resistancePrice,
    candidateArHigh,
    candidateArIndex,
    stDetected,
    stIndex,
    phaseBStartBar,
    phaseBBarsCount,
    utDetected,
    springDetected,
    phaseCLpsCandidate,
    phaseCLpsDetected,
    phaseCCompleted,
    sosDetected,
    sosIndex,
    sosHigh,
    phaseDLpsCandidate,
    phaseDLpsDetected,
    scaledIn,
    buDetected,
    currentTrailingStop,
  };

  const output: StrategyStepOutput = {
    orderIntent: {
      action: orderAction,
      allocationPct,
      stopLossPrice,
      takeProfitPrice: null,
      reason,
      phaseLabel: nextPhase,
    },
    markers,
    activeZone,
  };

  return { nextState, output };
}

export const WyckoffAccumulationV2Strategy: IStrategy<WyckoffInternalState> = {
  id: 'wyckoff-accumulation-v2',
  name: 'Wyckoff Accumulation Schematics #1 & #2',
  version: '2.0.0',
  category: 'WYCKOFF_VSA',
  description:
    'Quantitative Wyckoff Accumulation state machine tracking Phases A through E for Schematics #1 (Spring) and #2 (Higher-Low LPS) with dynamic ATR trailing stops.',
  parameters: WYCKOFF_PARAMETERS,
  init: initWyckoffState,
  onBar: evaluateWyckoffBar,
};
