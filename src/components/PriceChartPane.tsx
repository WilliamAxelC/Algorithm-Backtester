import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
  type SeriesMarker,
  type SeriesMarkerPosition,
  type SeriesMarkerShape,
} from 'lightweight-charts';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Maximize2,
} from 'lucide-react';
import type { BacktestResult } from '../types/backtest';
import type { OHLCVBar, WyckoffPhaseId, CurrencyCode } from '../types/market';
import { formatPrice, formatUnixDate, formatSignedPct } from '../utils/formatters';

export interface PriceChartPaneProps {
  readonly result: BacktestResult | null;
  readonly replayIndex: number | null;
  readonly onScrubReplay: (index: number | null) => void;
  readonly isPlaying: boolean;
  readonly onTogglePlay: () => void;
  readonly onStepForward: () => void;
  readonly onResetReplay: () => void;
}

function getPhaseBadgeStyle(phase: WyckoffPhaseId): string {
  switch (phase) {
    case 'PHASE_A':
      return 'bg-slate-100 text-slate-700 border-slate-300';
    case 'PHASE_B':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'PHASE_C':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'PHASE_D':
      return 'bg-teal-50 text-teal-700 border-teal-200';
    case 'PHASE_E':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default:
      return 'bg-slate-50 text-slate-500 border-slate-200';
  }
}

function formatPhaseName(phase: WyckoffPhaseId): string {
  switch (phase) {
    case 'PHASE_A':
      return 'Phase A';
    case 'PHASE_B':
      return 'Phase B';
    case 'PHASE_C':
      return 'Phase C (Spring / LPS)';
    case 'PHASE_D':
      return 'Phase D (SOS)';
    case 'PHASE_E':
      return 'Phase E (Markup)';
    default:
      return 'Consolidation';
  }
}

export const PriceChartPane: React.FC<PriceChartPaneProps> = ({
  result,
  replayIndex,
  onScrubReplay,
  isPlaying,
  onTogglePlay,
  onStepForward,
  onResetReplay,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);

  const [hoveredBar, setHoveredBar] = useState<OHLCVBar | null>(null);

  const currency: CurrencyCode = result?.asset?.currency ?? 'USD';
  const totalBars = result?.bars.length ?? 0;
  const currentIndex =
    replayIndex !== null
      ? Math.max(0, Math.min(totalBars - 1, replayIndex))
      : Math.max(0, totalBars - 1);

  // Bars visible in chart (sliced if replayIndex is active)
  const visibleBars: readonly OHLCVBar[] = useMemo(() => {
    if (!result || result.bars.length === 0) {
      return [];
    }
    if (replayIndex !== null) {
      return result.bars.slice(0, currentIndex + 1);
    }
    return result.bars;
  }, [result, replayIndex, currentIndex]);

  const currentBar: OHLCVBar | undefined = result?.bars[currentIndex];

  // Map for fast O(1) timestamp lookups during crosshair events
  const barMap = useMemo(() => {
    const map = new Map<number, OHLCVBar>();
    if (result && result.bars) {
      for (const bar of result.bars) {
        map.set(bar.time, bar);
      }
    }
    return map;
  }, [result]);

  // Phase lookup map by timestamp from equityCurve
  const phaseMap = useMemo(() => {
    const map = new Map<number, WyckoffPhaseId>();
    if (result && result.equityCurve) {
      for (const pt of result.equityCurve) {
        map.set(pt.time, pt.phase);
      }
    }
    return map;
  }, [result]);

  const displayBar: OHLCVBar | undefined = hoveredBar ?? currentBar;
  const activePhase: WyckoffPhaseId =
    displayBar !== undefined ? (phaseMap.get(displayBar.time) ?? 'NONE') : 'NONE';

  // 1. Initialize Lightweight Chart canvas and configure Swiss light mode tokens
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(container, {
      width: container.clientWidth || 800,
      height: container.clientHeight || 400,
      layout: {
        background: { type: ColorType.Solid, color: '#FFFFFF' },
        textColor: '#64748B',
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: '#F1F5F9' },
        horzLines: { color: '#F1F5F9' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: '#E2E8F0',
        scaleMargins: {
          top: 0.08,
          bottom: 0.22,
        },
      },
      timeScale: {
        borderColor: '#E2E8F0',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#0D9488',
      downColor: '#E11D48',
      borderUpColor: '#0D9488',
      borderDownColor: '#E11D48',
      wickUpColor: '#0D9488',
      wickDownColor: '#E11D48',
    });

    const volumeSeries = chart.addHistogramSeries({
      color: '#0D9488',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chart.subscribeCrosshairMove((param) => {
      if (param.time) {
        const timeNum = typeof param.time === 'number' ? param.time : 0;
        const bar = barMap.get(timeNum);
        setHoveredBar(bar ?? null);
      } else {
        setHoveredBar(null);
      }
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        chart.applyOptions({ width, height });
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [barMap]);

  // 2. Synchronize candlestick and volume series data
  useEffect(() => {
    const candleSeries = candlestickSeriesRef.current;
    const volSeries = volumeSeriesRef.current;
    if (!candleSeries || !volSeries) return;

    if (visibleBars.length === 0) {
      candleSeries.setData([]);
      volSeries.setData([]);
      return;
    }

    candleSeries.setData(
      visibleBars.map((bar) => ({
        time: bar.time as UTCTimestamp,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      }))
    );

    volSeries.setData(
      visibleBars.map((bar) => ({
        time: bar.time as UTCTimestamp,
        value: bar.volume,
        color:
          bar.close >= bar.open
            ? 'rgba(13, 148, 136, 0.45)'
            : 'rgba(225, 29, 72, 0.45)',
      }))
    );

    // Initial fit when full dataset is loaded
    if (replayIndex === null) {
      chartRef.current?.timeScale().fitContent();
    }
  }, [visibleBars, replayIndex]);

  // 3. Render Support & Resistance lines and Chart Markers
  useEffect(() => {
    const candleSeries = candlestickSeriesRef.current;
    if (!candleSeries || !result) return;

    // Remove existing price lines
    for (const line of priceLinesRef.current) {
      try {
        candleSeries.removePriceLine(line);
      } catch {
        // Ignored if already removed
      }
    }
    priceLinesRef.current = [];

    const cutoffTime = currentBar !== undefined ? currentBar.time : Infinity;

    // 3a. Add Support & Resistance lines from result.zones
    for (const zone of result.zones) {
      if (zone.startTime <= cutoffTime) {
        const supLine = candleSeries.createPriceLine({
          price: zone.supportPrice,
          color: '#2563EB',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${zone.label || 'TR'} Sup (${formatPrice(zone.supportPrice, currency)})`,
        });

        const resLine = candleSeries.createPriceLine({
          price: zone.resistancePrice,
          color: '#64748B',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${zone.label || 'TR'} Res (${formatPrice(zone.resistancePrice, currency)})`,
        });

        priceLinesRef.current.push(supLine, resLine);
      }
    }

    // 3b. Add Wyckoff and algorithm event markers
    const markers: SeriesMarker<UTCTimestamp>[] = [];

    for (const m of result.markers) {
      if (m.time > cutoffTime) {
        continue;
      }

      let position: SeriesMarkerPosition = m.position ?? 'belowBar';
      let shape: SeriesMarkerShape = m.shape ?? 'circle';
      let color: string = m.color ?? '#2563EB';

      switch (m.tag) {
        case 'PS':
          position = 'belowBar';
          shape = 'square';
          color = '#64748B';
          break;
        case 'SC':
          position = 'belowBar';
          shape = 'arrowUp';
          color = '#E11D48';
          break;
        case 'AR':
          position = 'aboveBar';
          shape = 'arrowDown';
          color = '#0D9488';
          break;
        case 'ST':
          position = 'belowBar';
          shape = 'circle';
          color = '#D97706';
          break;
        case 'UT':
          position = 'aboveBar';
          shape = 'arrowDown';
          color = '#D97706';
          break;
        case 'SPRING':
          position = 'belowBar';
          shape = 'arrowUp';
          color = '#2563EB';
          break;
        case 'SOS':
          position = 'aboveBar';
          shape = 'arrowUp';
          color = '#0D9488';
          break;
        case 'LPS':
          position = 'belowBar';
          shape = 'arrowUp';
          color = '#0D9488';
          break;
        case 'BU':
          position = 'aboveBar';
          shape = 'arrowUp';
          color = '#2563EB';
          break;
        case 'ENTRY':
          position = 'belowBar';
          shape = 'arrowUp';
          color = '#0D9488';
          break;
        case 'EXIT':
          position = 'aboveBar';
          shape = 'arrowDown';
          color = '#E11D48';
          break;
        default:
          if (m.label.includes('RSI-OS')) {
            position = 'belowBar';
            shape = 'circle';
            color = '#0D9488';
          } else if (m.label.includes('RSI-OB')) {
            position = 'aboveBar';
            shape = 'circle';
            color = '#E11D48';
          }
          break;
      }

      markers.push({
        time: m.time as UTCTimestamp,
        position,
        shape,
        color,
        text: m.label ? `${m.tag}: ${m.label}` : m.tag,
        id: `event-${m.tag}-${m.time}-${m.barIndex}`,
      });
    }

    // 3c. Add trade entry and exit markers
    for (const trade of result.trades) {
      if (trade.entryTime <= cutoffTime) {
        markers.push({
          time: trade.entryTime as UTCTimestamp,
          position: 'belowBar',
          shape: 'arrowUp',
          color: '#0D9488',
          text: `BUY #${trade.id} @ ${formatPrice(trade.entryPrice, currency)}`,
          id: `trade-in-${trade.id}`,
        });
      }

      if (trade.exitTime <= cutoffTime) {
        const isWin = trade.netPnl >= 0;
        markers.push({
          time: trade.exitTime as UTCTimestamp,
          position: 'aboveBar',
          shape: 'arrowDown',
          color: isWin ? '#0D9488' : '#E11D48',
          text: `EXIT #${trade.id} (${trade.exitReason}) @ ${formatPrice(trade.exitPrice, currency)}`,
          id: `trade-out-${trade.id}`,
        });
      }
    }

    // Strictly ascending timestamp sort required by lightweight-charts
    markers.sort((a, b) => Number(a.time) - Number(b.time));
    candleSeries.setMarkers(markers);
  }, [result, currentBar, currency]);

  const handleFitContent = useCallback((): void => {
    chartRef.current?.timeScale().fitContent();
  }, []);

  // Format active bar metrics
  const barChange = displayBar !== undefined ? displayBar.close - displayBar.open : 0;
  const barChangePct =
    displayBar !== undefined && displayBar.open > 0
      ? (barChange / displayBar.open) * 100
      : 0;
  const barColorClass =
    barChange >= 0 ? 'text-teal-600 font-semibold' : 'text-rose-600 font-semibold';

  return (
    <div className="w-full h-full flex flex-col bg-white select-none">
      {/* Top Crosshair Legend Strip */}
      <div className="flex-shrink-0 px-3.5 py-1.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-3 text-xs">
          <span className="font-mono font-bold text-slate-900 tracking-tight">
            {result?.symbol ?? 'CHART'}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
            {result?.timeframe ?? '1D'}
          </span>

          {displayBar !== undefined && (
            <div className="flex items-center space-x-2 text-[11px] font-mono tabular-nums text-slate-600 border-l border-slate-200 pl-3">
              <span>
                <span className="text-slate-400 font-normal">O: </span>
                {formatPrice(displayBar.open, currency)}
              </span>
              <span>
                <span className="text-slate-400 font-normal">H: </span>
                {formatPrice(displayBar.high, currency)}
              </span>
              <span>
                <span className="text-slate-400 font-normal">L: </span>
                {formatPrice(displayBar.low, currency)}
              </span>
              <span>
                <span className="text-slate-400 font-normal">C: </span>
                {formatPrice(displayBar.close, currency)}
              </span>
              <span className={barColorClass}>
                {barChange >= 0 ? '+' : ''}
                {formatPrice(barChange, currency)} ({formatSignedPct(barChangePct)})
              </span>
              <span className="text-slate-300">|</span>
              <span>
                <span className="text-slate-400 font-normal">Vol: </span>
                {displayBar.volume.toLocaleString('en-US')}
              </span>
            </div>
          )}
        </div>

        {/* Right HUD: Wyckoff Phase Badge & Fit Button */}
        <div className="flex items-center gap-2">
          {activePhase !== 'NONE' && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold border ${getPhaseBadgeStyle(activePhase)}`}
            >
              {formatPhaseName(activePhase)}
            </span>
          )}
          <button
            type="button"
            onClick={handleFitContent}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Fit chart view"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Center Chart Canvas */}
      <div ref={containerRef} className="flex-1 w-full min-h-0 relative" />

      {/* Docked Bar-by-Bar Replay Scrubber Strip */}
      <div className="flex-shrink-0 border-t border-slate-200 bg-white px-4 py-2 flex items-center gap-3 select-none">
        {/* Play/Pause Toggle */}
        <button
          type="button"
          onClick={onTogglePlay}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
          title={isPlaying ? 'Pause replay' : 'Play bar-by-bar replay'}
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 text-blue-600 fill-blue-600" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 text-blue-600 fill-blue-600" />
              <span>Play</span>
            </>
          )}
        </button>

        {/* Step Forward */}
        <button
          type="button"
          onClick={onStepForward}
          disabled={currentIndex >= totalBars - 1}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          title="Step forward 1 bar"
        >
          <SkipForward className="w-3.5 h-3.5 text-slate-600" />
          <span>Step</span>
        </button>

        {/* Reset */}
        <button
          type="button"
          onClick={onResetReplay}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
          title="Reset to full dataset window"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
          <span>Reset</span>
        </button>

        {/* Slider Track / Range Input */}
        <div className="flex-1 flex items-center px-2">
          <input
            type="range"
            min={0}
            max={Math.max(0, totalBars - 1)}
            value={currentIndex}
            onChange={(e) => onScrubReplay(Number(e.target.value))}
            className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
          />
        </div>

        {/* Live Readout Badge */}
        <div className="flex-shrink-0 text-xs font-mono tabular-nums text-slate-700 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
          {currentBar !== undefined ? (
            <span>
              Bar {currentIndex + 1} of {totalBars} · {formatUnixDate(currentBar.time)} · Close:{' '}
              {formatPrice(currentBar.close, currency)}
            </span>
          ) : (
            <span>No bar data</span>
          )}
        </div>
      </div>
    </div>
  );
};
