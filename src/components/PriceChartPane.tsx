import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
} from 'lightweight-charts';
import type {
  IChartApi,
  ISeriesApi,
  IPriceLine,
  UTCTimestamp,
  SeriesMarker,
  Time,
} from 'lightweight-charts';
import { Maximize2, Layers } from 'lucide-react';
import type { BacktestResult } from '../types/backtest';
import type { OHLCVBar, WyckoffPhaseId } from '../types/market';

export interface PriceChartPaneProps {
  readonly result: BacktestResult | null;
  readonly selectedEvent?: { readonly barIndex: number; readonly time: number } | null;
}

type PhaseFilterId = 'ALL' | WyckoffPhaseId;

const PHASE_FILTER_PILLS: readonly { readonly id: PhaseFilterId; readonly label: string }[] = [
  { id: 'ALL', label: 'All Phases' },
  { id: 'PHASE_A', label: 'Phase A' },
  { id: 'PHASE_B', label: 'Phase B' },
  { id: 'PHASE_C', label: 'Phase C' },
  { id: 'PHASE_D', label: 'Phase D' },
  { id: 'PHASE_E', label: 'Phase E' },
];

export const PriceChartPane: React.FC<PriceChartPaneProps> = ({
  result,
  selectedEvent,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);

  const [activePhaseFilter, setActivePhaseFilter] = useState<PhaseFilterId>('ALL');
  const [hoveredBar, setHoveredBar] = useState<OHLCVBar | null>(null);

  // Map for rapid O(1) bar lookups by timestamp during crosshair events
  const barMap = useMemo(() => {
    const map = new Map<number, OHLCVBar>();
    if (result && result.bars) {
      for (const bar of result.bars) {
        map.set(bar.time, bar);
      }
    }
    return map;
  }, [result]);

  // Fallback active bar for the legend when crosshair is idle
  const latestBar: OHLCVBar | null = useMemo(() => {
    if (hoveredBar) return hoveredBar;
    if (result && result.bars.length > 0) {
      const last = result.bars[result.bars.length - 1];
      return last ?? null;
    }
    return null;
  }, [hoveredBar, result]);

  // 1. Initialize Lightweight Chart canvas and configure Swiss light mode tokens
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Remove any previous instance if container re-mounts
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(container, {
      width: container.clientWidth || 800,
      height: container.clientHeight || 400,
      layout: {
        background: { type: ColorType.Solid, color: '#FFFFFF' },
        textColor: '#475569',
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

    // Volume histogram overlaid on bottom 18% of pane
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // Overlay scale
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
    });

    // Crosshair movement listener for OHLCV legend
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        setHoveredBar(null);
        return;
      }
      const timeNum = Number(param.time);
      const found = barMap.get(timeNum);
      setHoveredBar(found ?? null);
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

    // Handle responsive container resizing
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !chartRef.current) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        chartRef.current.applyOptions({ width, height });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      candlestickSeriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLinesRef.current = [];
    };
  }, []);

  // 2. Load Bars & Volume data whenever result changes
  useEffect(() => {
    const candleSeries = candlestickSeriesRef.current;
    const volSeries = volumeSeriesRef.current;
    const chart = chartRef.current;
    if (!candleSeries || !volSeries || !chart || !result || result.bars.length === 0) {
      return;
    }

    // Ensure ascending sort and UTCTimestamp casting
    const sortedBars = [...result.bars].sort((a, b) => a.time - b.time);

    const candleData = sortedBars.map((b) => ({
      time: b.time as UTCTimestamp,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));

    const volumeData = sortedBars.map((b) => {
      const isUp = b.close >= b.open;
      return {
        time: b.time as UTCTimestamp,
        value: b.volume,
        color: isUp ? 'rgba(13, 148, 136, 0.45)' : 'rgba(225, 29, 72, 0.45)',
      };
    });

    candleSeries.setData(candleData);
    volSeries.setData(volumeData);

    // Clear previous price lines
    for (const pl of priceLinesRef.current) {
      candleSeries.removePriceLine(pl);
    }
    priceLinesRef.current = [];

    // Plot horizontal Trading Range price lines if detected
    if (result.zones && result.zones.length > 0) {
      const latestZone = result.zones[result.zones.length - 1];
      if (latestZone) {
        const supportLine = candleSeries.createPriceLine({
          price: latestZone.supportPrice,
          color: '#0D9488',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'TR Support (SC/ST Low)',
        });
        priceLinesRef.current.push(supportLine);

        const resistanceLine = candleSeries.createPriceLine({
          price: latestZone.resistancePrice,
          color: '#2563EB',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'TR Resistance (AR High)',
        });
        priceLinesRef.current.push(resistanceLine);
      }
    }

    chart.timeScale().fitContent();
  }, [result]);

  // 3. Update Markers when active phase filter or result changes
  useEffect(() => {
    const candleSeries = candlestickSeriesRef.current;
    if (!candleSeries || !result) return;

    const markers: SeriesMarker<Time>[] = [];

    // 3a. Wyckoff strategy event annotations
    for (const m of result.markers) {
      if (activePhaseFilter !== 'ALL' && m.phase !== activePhaseFilter) {
        continue;
      }
      markers.push({
        time: m.time as UTCTimestamp,
        position: m.position,
        shape: m.shape,
        color: m.color,
        text: m.label ? `${m.tag}: ${m.label}` : m.tag,
        id: `event-${m.tag}-${m.time}-${m.barIndex}`,
      });
    }

    // 3b. Executed Trade entry and exit markers
    for (const trade of result.trades) {
      if (activePhaseFilter === 'ALL' || trade.entryPhase === activePhaseFilter) {
        markers.push({
          time: trade.entryTime as UTCTimestamp,
          position: 'belowBar',
          shape: 'arrowUp',
          color: '#0D9488',
          text: `BUY #${trade.id} @ $${trade.entryPrice.toFixed(2)}`,
          id: `trade-in-${trade.id}`,
        });
      }

      if (activePhaseFilter === 'ALL' || trade.entryPhase === activePhaseFilter) {
        const isWin = trade.netPnl >= 0;
        markers.push({
          time: trade.exitTime as UTCTimestamp,
          position: 'aboveBar',
          shape: 'arrowDown',
          color: isWin ? '#0D9488' : '#E11D48',
          text: `EXIT #${trade.id} (${trade.exitReason}) @ $${trade.exitPrice.toFixed(2)}`,
          id: `trade-out-${trade.id}`,
        });
      }
    }

    // Strictly ascending timestamp sort required by lightweight-charts
    markers.sort((a, b) => Number(a.time) - Number(b.time));
    candleSeries.setMarkers(markers);
  }, [result, activePhaseFilter]);

  // 4. Scroll / Center chart when selectedEvent is triggered from ledger
  useEffect(() => {
    if (!selectedEvent || !chartRef.current || !result || result.bars.length === 0) {
      return;
    }
    const idx = selectedEvent.barIndex;
    const windowSize = 16;
    chartRef.current.timeScale().setVisibleLogicalRange({
      from: Math.max(0, idx - windowSize),
      to: Math.min(result.bars.length - 1, idx + windowSize),
    });
  }, [selectedEvent, result]);

  const handleFitContent = (): void => {
    chartRef.current?.timeScale().fitContent();
  };

  // Format active bar metrics
  const isUpBar = latestBar ? latestBar.close >= latestBar.open : true;
  const barChange = latestBar ? latestBar.close - latestBar.open : 0;
  const barChangePct =
    latestBar && latestBar.open > 0 ? (barChange / latestBar.open) * 100 : 0;

  return (
    <div className="w-full h-full flex flex-col bg-white select-none">
      {/* Top Toolbar Strip */}
      <div className="flex-shrink-0 px-3.5 py-1.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        {/* Left Segment: Symbol, Timeframe & Hover OHLCV Legend */}
        <div className="flex items-center space-x-3 text-xs">
          {result && (
            <div className="flex items-center space-x-1.5 font-bold text-slate-800">
              <span>{result.symbol}</span>
              <span className="text-[10px] font-mono px-1 py-0.2 bg-slate-100 text-slate-600 rounded">
                {result.timeframe}
              </span>
            </div>
          )}

          {latestBar ? (
            <div className="flex items-center space-x-2.5 font-mono tabular-nums text-xs">
              <span className="text-slate-400 text-[11px]">
                {new Date(latestBar.time * 1000).toISOString().replace('T', ' ').substring(0, 16)}
              </span>
              <span>
                <span className="text-slate-400 mr-0.5">O:</span>
                <span className="font-semibold text-slate-800">
                  ${latestBar.open.toFixed(2)}
                </span>
              </span>
              <span>
                <span className="text-slate-400 mr-0.5">H:</span>
                <span className="font-semibold text-slate-800">
                  ${latestBar.high.toFixed(2)}
                </span>
              </span>
              <span>
                <span className="text-slate-400 mr-0.5">L:</span>
                <span className="font-semibold text-slate-800">
                  ${latestBar.low.toFixed(2)}
                </span>
              </span>
              <span>
                <span className="text-slate-400 mr-0.5">C:</span>
                <span
                  className={`font-semibold ${
                    isUpBar ? 'text-[#0D9488]' : 'text-[#E11D48]'
                  }`}
                >
                  ${latestBar.close.toFixed(2)}
                </span>
              </span>
              <span
                className={`text-[11px] font-medium ${
                  isUpBar ? 'text-[#0D9488]' : 'text-[#E11D48]'
                }`}
              >
                {barChange >= 0 ? '+' : ''}
                {barChange.toFixed(2)} ({barChangePct >= 0 ? '+' : ''}
                {barChangePct.toFixed(2)}%)
              </span>
              <span>
                <span className="text-slate-400 mr-0.5">Vol:</span>
                <span className="text-slate-700">
                  {latestBar.volume.toLocaleString('en-US')}
                </span>
              </span>
            </div>
          ) : (
            <div className="font-mono text-xs text-slate-400">
              Awaiting dataset load...
            </div>
          )}
        </div>

        {/* Right Segment: Phase Filter Pills & Fit Content Button */}
        <div className="flex items-center space-x-2">
          {/* Phase Filter Pills */}
          <div className="flex items-center space-x-1 bg-slate-50 p-0.5 rounded border border-slate-200">
            <Layers className="w-3 h-3 text-slate-400 ml-1 mr-0.5" />
            {PHASE_FILTER_PILLS.map((pill) => {
              const isActive = activePhaseFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setActivePhaseFilter(pill.id)}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-none'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>

          {/* Fit Content Action */}
          <button
            type="button"
            onClick={handleFitContent}
            className="inline-flex items-center space-x-1 px-2 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded shadow-none transition-colors"
            title="Auto-fit time scale and price range"
          >
            <Maximize2 className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-[11px]">Fit Content</span>
          </button>
        </div>
      </div>

      {/* Lightweight Charts Canvas Host */}
      <div className="flex-1 w-full min-h-0 relative">
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      </div>
    </div>
  );
};
