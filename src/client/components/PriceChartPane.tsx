import React, { useEffect, useRef, useState } from 'react';
import {
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type SeriesMarker,
  type UTCTimestamp,
} from 'lightweight-charts';
import type {
  AssetMetadata,
  CandleInterval,
  ChartMarkerAnnotation,
  HorizontalZoneAnnotation,
  LiveQuoteTick,
  OHLCVBar,
} from '../../shared/types/market';
import {
  formatPrice,
  formatUnixDate,
  formatWibClock,
  toWibChartTime,
  fromWibChartTime,
} from '../../shared/utils/formatters';

interface PriceChartPaneProps {
  readonly asset: AssetMetadata;
  readonly displayInterval: CandleInterval;
  readonly executionInterval: CandleInterval;
  readonly bars: readonly OHLCVBar[];
  readonly markers: readonly ChartMarkerAnnotation[];
  readonly zones: readonly HorizontalZoneAnnotation[];
  readonly liveTick: LiveQuoteTick | null;
  readonly onMarkerClick?: (marker: ChartMarkerAnnotation) => void;
}

export const PriceChartPane: React.FC<PriceChartPaneProps> = ({
  asset,
  displayInterval,
  executionInterval,
  bars,
  markers,
  zones,
  liveTick,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const lastBarRef = useRef<OHLCVBar | null>(null);

  const [crosshairBar, setCrosshairBar] = useState<OHLCVBar | null>(null);
  const [liveBar, setLiveBar] = useState<OHLCVBar | null>(null);

  // Initialize and handle chart container setup
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      localization: {
        timeFormatter: (timeSec: number) => {
          return formatUnixDate(fromWibChartTime(timeSec), displayInterval !== '1d');
        },
      },
      layout: {
        background: { type: ColorType.Solid, color: '#FFFFFF' },
        textColor: '#64748B',
        fontFamily: 'Inter, -apple-system, sans-serif',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#F1F5F9' },
        horzLines: { color: '#F1F5F9' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#94A3B8',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#0F172A',
        },
        horzLine: {
          color: '#94A3B8',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#0F172A',
        },
      },
      rightPriceScale: {
        borderColor: '#E2E8F0',
        autoScale: true,
      },
      timeScale: {
        borderColor: '#E2E8F0',
        timeVisible: displayInterval !== '1d',
        secondsVisible: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#0D9488',
      downColor: '#E11D48',
      borderUpColor: '#0D9488',
      borderDownColor: '#E11D48',
      wickUpColor: '#0D9488',
      wickDownColor: '#E11D48',
    });

    const volumeSeries = chart.addHistogramSeries({
      color: '#CBD5E1',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // Overlay over price
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Crosshair legend handler
    chart.subscribeCrosshairMove((param) => {
      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.y < 0
      ) {
        setCrosshairBar(null);
      } else {
        const barData = param.seriesData.get(candleSeries) as
          | { open: number; high: number; low: number; close: number; time: number }
          | undefined;

        if (barData) {
          const volData = param.seriesData.get(volumeSeries) as
            | { value: number }
            | undefined;
          setCrosshairBar({
            time: typeof barData.time === 'number' ? fromWibChartTime(barData.time) : 0,
            open: barData.open,
            high: barData.high,
            low: barData.low,
            close: barData.close,
            volume: volData?.value ?? 0,
          });
        }
      }
    });

    // Resize Observer for fluid responsiveness
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries[0]) return;
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [displayInterval]);

  // Load Bars and Markers
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!candleSeries || !volumeSeries || bars.length === 0) return;

    // Ensure strictly ascending unique timestamps
    const cleanCandles: {
      time: UTCTimestamp;
      open: number;
      high: number;
      low: number;
      close: number;
    }[] = [];
    const cleanVolumes: {
      time: UTCTimestamp;
      value: number;
      color: string;
    }[] = [];

    const seenTimes = new Set<number>();

    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      if (!b || seenTimes.has(b.time)) continue;
      seenTimes.add(b.time);

      const time = toWibChartTime(b.time) as UTCTimestamp;
      cleanCandles.push({
        time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      });

      cleanVolumes.push({
        time,
        value: b.volume,
        color: b.close >= b.open ? '#99F6E4' : '#FECDD3',
      });
    }

    candleSeries.setData(cleanCandles);
    volumeSeries.setData(cleanVolumes);

    // Synchronize mutable lastBarRef and live state
    const last = bars.length > 0 ? bars[bars.length - 1] : null;
    lastBarRef.current = last ? { ...last } : null;
    setLiveBar(last ? { ...last } : null);

    // Apply markers mapped to ascending time in GMT+7 WIB
    const chartMarkers: SeriesMarker<UTCTimestamp>[] = [];
    const markerTimes = new Set<string>();

    for (let i = 0; i < markers.length; i++) {
      const m = markers[i];
      if (!m || !seenTimes.has(m.time)) continue;

      const key = `${m.time}_${m.tag}`;
      if (markerTimes.has(key)) continue;
      markerTimes.add(key);

      chartMarkers.push({
        time: toWibChartTime(m.time) as UTCTimestamp,
        position: m.position,
        shape: m.shape,
        color: m.color,
        text: m.label,
      });
    }

    chartMarkers.sort((a, b) => (Number(a.time) - Number(b.time)));
    candleSeries.setMarkers(chartMarkers);

    // Clear previous TR price lines
    if (priceLinesRef.current.length > 0) {
      for (const pl of priceLinesRef.current) {
        try {
          candleSeries.removePriceLine(pl);
        } catch {
          // ignore
        }
      }
      priceLinesRef.current = [];
    }

    // Render active Wyckoff TR support / resistance lines
    const latestZone = zones[zones.length - 1];
    if (latestZone) {
      const supportLine = candleSeries.createPriceLine({
        price: latestZone.supportPrice,
        color: '#0D9488',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `TR Support (${latestZone.supportPrice.toFixed(2)})`,
      });

      const resistanceLine = candleSeries.createPriceLine({
        price: latestZone.resistancePrice,
        color: '#E11D48',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `TR Resistance (${latestZone.resistancePrice.toFixed(2)})`,
      });

      priceLinesRef.current = [supportLine, resistanceLine];
    }

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [bars, markers, zones]);

  // Live 1-Second Tick Pulse & Rightmost Candle Mutation
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!candleSeries || !volumeSeries || !liveTick) return;

    // Determine bucket size in seconds from displayInterval
    const bucketSec = displayInterval === '1m' ? 60 : displayInterval === '1h' ? 3600 : 86400;
    const tickBucketTime = Math.floor(liveTick.timestampSec / bucketSec) * bucketSec;

    if (!lastBarRef.current || tickBucketTime > lastBarRef.current.time) {
      // New candle bucket started
      const newBar: OHLCVBar = {
        time: tickBucketTime,
        open: lastBarRef.current ? lastBarRef.current.close : liveTick.price,
        high: liveTick.price,
        low: liveTick.price,
        close: liveTick.price,
        volume: 0,
      };
      lastBarRef.current = newBar;
    } else {
      // Mutate current rightmost candle bucket
      const cur = lastBarRef.current;
      const updatedBar: OHLCVBar = {
        time: cur.time,
        open: cur.open,
        high: Math.max(cur.high, liveTick.price),
        low: Math.min(cur.low, liveTick.price),
        close: liveTick.price,
        volume: cur.volume + Math.max(0, liveTick.volume24h > 0 ? 1 : 0),
      };
      lastBarRef.current = updatedBar;
    }

    if (lastBarRef.current) {
      candleSeries.update({
        time: toWibChartTime(lastBarRef.current.time) as UTCTimestamp,
        open: lastBarRef.current.open,
        high: lastBarRef.current.high,
        low: lastBarRef.current.low,
        close: lastBarRef.current.close,
      });
      volumeSeries.update({
        time: toWibChartTime(lastBarRef.current.time) as UTCTimestamp,
        value: lastBarRef.current.volume,
        color: lastBarRef.current.close >= lastBarRef.current.open ? '#99F6E4' : '#FECDD3',
      });
      setLiveBar({ ...lastBarRef.current });
    }
  }, [liveTick, displayInterval]);

  // Active bar for header legend (crosshair bar or latest live bar)
  const legendBar = crosshairBar ?? liveBar ?? (bars.length > 0 ? bars[bars.length - 1] : null);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white border-b border-slate-200">
      {/* Chart Status Header */}
      <div className="px-4 py-2 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50 text-xs">
        {/* Left: Resolution & Microstructure Badges */}
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-slate-800 text-xs">
            {asset.symbol}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
            View: {displayInterval.toUpperCase()} Candles
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
            Strategy Execution: {executionInterval.toUpperCase()} Optimized
          </span>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            1s LIVE PULSE • {formatWibClock(liveTick?.timestampSec ?? Math.floor(Date.now() / 1000))}
          </span>
        </div>

        {/* Right: Live OHLCV Floating Numbers */}
        {legendBar && (
          <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums text-slate-600">
            <span>
              O: <strong className="text-slate-900">{formatPrice(legendBar.open, asset.currency)}</strong>
            </span>
            <span>
              H: <strong className="text-teal-700">{formatPrice(legendBar.high, asset.currency)}</strong>
            </span>
            <span>
              L: <strong className="text-rose-700">{formatPrice(legendBar.low, asset.currency)}</strong>
            </span>
            <span>
              C:{' '}
              <strong
                className={legendBar.close >= legendBar.open ? 'text-teal-700' : 'text-rose-700'}
              >
                {formatPrice(legendBar.close, asset.currency)}
              </strong>
            </span>
            <span>
              Vol: <strong className="text-slate-800">{Math.round(legendBar.volume).toLocaleString()}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Lightweight-charts Canvas Mount */}
      <div
        ref={chartContainerRef}
        className="flex-1 w-full min-h-[360px] relative"
      />
    </div>
  );
};
