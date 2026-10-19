import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Download,
  FileText,
  ListOrdered,
  TrendingUp,
} from 'lucide-react';
import type {
  EquityPoint,
  MonthlyReturnCell,
  TradeRecord,
} from '../../shared/types/backtest';
import type {
  AssetMetadata,
  ChartMarkerAnnotation,
} from '../../shared/types/market';
import {
  formatCurrency,
  formatPrice,
  formatSignedPct,
  formatUnixDate,
} from '../../shared/utils/formatters';

interface BottomInspectorTabsProps {
  readonly asset: AssetMetadata;
  readonly equityCurve: readonly EquityPoint[];
  readonly trades: readonly TradeRecord[];
  readonly markers: readonly ChartMarkerAnnotation[];
  readonly monthlyReturns: readonly MonthlyReturnCell[];
  readonly onFocusTimestamp?: (time: number) => void;
}

type TabId = 'EQUITY_CURVE' | 'WYCKOFF_LOG' | 'TRADE_LEDGER' | 'MONTHLY_HEATMAP';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const BottomInspectorTabs: React.FC<BottomInspectorTabsProps> = ({
  asset,
  equityCurve,
  trades,
  markers,
  monthlyReturns,
  onFocusTimestamp,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('EQUITY_CURVE');

  // CSV Export for Trade Ledger
  const handleExportCSV = () => {
    if (trades.length === 0) return;

    const headers = [
      'Trade ID',
      'Entry Time (UTC)',
      'Exit Time (UTC)',
      'Entry Price',
      'Exit Price',
      'Quantity',
      'Lots',
      'Gross PnL',
      'Total Fees',
      'Net PnL',
      'Return Pct',
      'Holding Bars',
      'Exit Reason',
      'Exit Detail',
    ];

    const rows = trades.map((t) => [
      t.id,
      formatUnixDate(t.entryTime, true),
      formatUnixDate(t.exitTime, true),
      t.entryPrice.toFixed(4),
      t.exitPrice.toFixed(4),
      t.quantity,
      t.lots,
      t.grossPnl.toFixed(2),
      t.totalFees.toFixed(2),
      t.netPnl.toFixed(2),
      `${t.returnPct.toFixed(2)}%`,
      t.holdingBars,
      t.exitReason,
      `"${t.exitDetail.replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${asset.symbol}_trade_ledger_10y.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Group monthly returns by Year for Heatmap Matrix
  const heatmapData = useMemo(() => {
    const yearsMap = new Map<number, Record<number, number>>();
    for (const cell of monthlyReturns) {
      let yearObj = yearsMap.get(cell.year);
      if (!yearObj) {
        yearObj = {};
        yearsMap.set(cell.year, yearObj);
      }
      yearObj[cell.month] = cell.returnPct;
    }

    const years = Array.from(yearsMap.keys()).sort((a, b) => b - a); // Descending years
    return { years, yearsMap };
  }, [monthlyReturns]);

  return (
    <div className="h-64 bg-white border-t border-slate-200 flex flex-col text-xs">
      {/* Tab Navigation Header */}
      <div className="flex items-center justify-between px-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('EQUITY_CURVE')}
            className={`px-3 py-2 font-mono text-[11px] font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'EQUITY_CURVE'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Strategy vs Buy & Hold Curve
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('WYCKOFF_LOG')}
            className={`px-3 py-2 font-mono text-[11px] font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'WYCKOFF_LOG'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Plain-English Story Log ({markers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('TRADE_LEDGER')}
            className={`px-3 py-2 font-mono text-[11px] font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'TRADE_LEDGER'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            Trade Ledger ({trades.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('MONTHLY_HEATMAP')}
            className={`px-3 py-2 font-mono text-[11px] font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'MONTHLY_HEATMAP'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            10Y Monthly Return Heatmap
          </button>
        </div>

        {activeTab === 'TRADE_LEDGER' && (
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded transition-colors shadow-none"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export CSV
          </button>
        )}
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-auto p-3">
        {/* TAB 1: SVG Dual Equity Curve */}
        {activeTab === 'EQUITY_CURVE' && (
          <div className="h-full flex flex-col justify-between">
            <div className="flex items-center justify-between px-2 text-[11px] font-mono text-slate-500 pb-1">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
                  <strong className="text-slate-800">Strategy Equity</strong> (Active Allocation)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-0.5 bg-slate-400 border border-slate-400 border-dashed" />
                  <strong className="text-slate-600">Buy & Hold Benchmark</strong> (Passive Buy)
                </span>
              </div>
              <span>
                {equityCurve.length} Simulation Points • 10Y Timeline
              </span>
            </div>

            {/* SVG Normalized Equity Curve Chart */}
            <div className="flex-1 w-full bg-slate-50 border border-slate-200 rounded relative overflow-hidden flex items-center justify-center p-2">
              {equityCurve.length < 2 ? (
                <span className="text-slate-400 font-mono">Insufficient equity data points</span>
              ) : (
                <svg className="w-full h-full" viewBox="0 0 1000 160" preserveAspectRatio="none">
                  {(() => {
                    const stratVals = equityCurve.map((p) => p.strategyEquity);
                    const benchVals = equityCurve.map((p) => p.benchmarkEquity);
                    const minVal = Math.min(...stratVals, ...benchVals) * 0.98;
                    const maxVal = Math.max(...stratVals, ...benchVals) * 1.02;
                    const range = Math.max(maxVal - minVal, 1);

                    const getY = (v: number) => 150 - ((v - minVal) / range) * 140;
                    const getX = (idx: number) => (idx / (equityCurve.length - 1)) * 980 + 10;

                    const stratPath = equityCurve
                      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(p.strategyEquity).toFixed(1)}`)
                      .join(' ');

                    const benchPath = equityCurve
                      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(p.benchmarkEquity).toFixed(1)}`)
                      .join(' ');

                    const areaPath = `${stratPath} L ${getX(equityCurve.length - 1)} 155 L 10 155 Z`;

                    return (
                      <>
                        <path d={areaPath} fill="#CCFBF1" fillOpacity="0.4" />
                        <path d={benchPath} fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="4 3" />
                        <path d={stratPath} fill="none" stroke="#0D9488" strokeWidth="2" />
                      </>
                    );
                  })()}
                </svg>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Wyckoff & Signal Story Log */}
        {activeTab === 'WYCKOFF_LOG' && (
          <div className="h-full overflow-y-auto">
            {markers.length === 0 ? (
              <div className="py-8 text-center text-slate-400 font-mono">No markers in range</div>
            ) : (
              <table className="w-full text-left font-mono text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                    <th className="py-1.5 px-2">Date (UTC)</th>
                    <th className="py-1.5 px-2">Phase</th>
                    <th className="py-1.5 px-2">Tag</th>
                    <th className="py-1.5 px-2">Price</th>
                    <th className="py-1.5 px-2">Plain-English Story</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {markers.map((m, idx) => (
                    <tr
                      key={idx}
                      onClick={() => onFocusTimestamp?.(m.time)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="py-1.5 px-2 text-slate-600 whitespace-nowrap">
                        {formatUnixDate(m.time)}
                      </td>
                      <td className="py-1.5 px-2 whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">
                          {m.phase}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold ${
                            m.tag === 'SC' || m.tag === 'EXIT'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-teal-50 text-teal-700'
                          }`}
                        >
                          {m.tag}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 tabular-nums font-semibold text-slate-800">
                        {formatPrice(m.price, asset.currency)}
                      </td>
                      <td className="py-1.5 px-2 text-slate-700">{m.plainEnglishStory}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 3: Executed Trade Ledger */}
        {activeTab === 'TRADE_LEDGER' && (
          <div className="h-full overflow-y-auto">
            {trades.length === 0 ? (
              <div className="py-8 text-center text-slate-400 font-mono">No closed trades in selected range</div>
            ) : (
              <table className="w-full text-left font-mono text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                    <th className="py-1.5 px-2">Entry Date</th>
                    <th className="py-1.5 px-2">Exit Date</th>
                    <th className="py-1.5 px-2">Entry Price</th>
                    <th className="py-1.5 px-2">Exit Price</th>
                    <th className="py-1.5 px-2">Size / Lots</th>
                    <th className="py-1.5 px-2">Fees</th>
                    <th className="py-1.5 px-2">Net PnL</th>
                    <th className="py-1.5 px-2">Return %</th>
                    <th className="py-1.5 px-2">Exit Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trades.map((t) => {
                    const isWin = t.netPnl > 0;
                    return (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-1.5 px-2 text-slate-600 whitespace-nowrap">
                          {formatUnixDate(t.entryTime)}
                        </td>
                        <td className="py-1.5 px-2 text-slate-600 whitespace-nowrap">
                          {formatUnixDate(t.exitTime)}
                        </td>
                        <td className="py-1.5 px-2 tabular-nums">
                          {formatPrice(t.entryPrice, asset.currency)}
                        </td>
                        <td className="py-1.5 px-2 tabular-nums">
                          {formatPrice(t.exitPrice, asset.currency)}
                        </td>
                        <td className="py-1.5 px-2 tabular-nums text-slate-600">
                          {t.quantity} ({t.lots} lots)
                        </td>
                        <td className="py-1.5 px-2 tabular-nums text-slate-500">
                          {formatCurrency(t.totalFees, asset.currency, true)}
                        </td>
                        <td
                          className={`py-1.5 px-2 tabular-nums font-bold ${
                            isWin ? 'text-teal-600' : 'text-rose-600'
                          }`}
                        >
                          {formatCurrency(t.netPnl, asset.currency, true)}
                        </td>
                        <td
                          className={`py-1.5 px-2 tabular-nums font-bold ${
                            isWin ? 'text-teal-600' : 'text-rose-600'
                          }`}
                        >
                          {formatSignedPct(t.returnPct)}
                        </td>
                        <td className="py-1.5 px-2 text-slate-600 whitespace-nowrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              t.exitReason === 'STOP_LOSS'
                                ? 'bg-rose-50 text-rose-700'
                                : t.exitReason === 'TAKE_PROFIT'
                                ? 'bg-teal-50 text-teal-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {t.exitReason}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 4: 10-Year Monthly Return Heatmap */}
        {activeTab === 'MONTHLY_HEATMAP' && (
          <div className="h-full overflow-y-auto">
            {heatmapData.years.length === 0 ? (
              <div className="py-8 text-center text-slate-400 font-mono">No monthly return data</div>
            ) : (
              <table className="w-full text-center font-mono text-[11px] border border-slate-200">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="py-1 px-2 text-left">Year</th>
                    {MONTH_NAMES.map((m) => (
                      <th key={m} className="py-1 px-1">
                        {m}
                      </th>
                    ))}
                    <th className="py-1 px-2 text-right">Year Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {heatmapData.years.map((year) => {
                    const row = heatmapData.yearsMap.get(year) ?? {};
                    let yearCompound = 1.0;
                    let hasTradesInYear = false;

                    const monthTds = Array.from({ length: 12 }, (_, idx) => {
                      const monthNum = idx + 1;
                      const ret = row[monthNum];
                      if (typeof ret === 'number') {
                        hasTradesInYear = true;
                        yearCompound *= 1 + ret / 100;
                        const isPos = ret > 0;
                        return (
                          <td
                            key={monthNum}
                            className={`py-1 px-1 tabular-nums ${
                              isPos
                                ? 'bg-teal-50/80 text-teal-700 font-medium'
                                : ret < 0
                                ? 'bg-rose-50/80 text-rose-700 font-medium'
                                : 'text-slate-400'
                            }`}
                          >
                            {ret.toFixed(1)}%
                          </td>
                        );
                      }
                      return (
                        <td key={monthNum} className="py-1 px-1 text-slate-300">
                          -
                        </td>
                      );
                    });

                    const yearTotalPct = hasTradesInYear ? (yearCompound - 1) * 100 : 0;
                    const isYearPos = yearTotalPct > 0;

                    return (
                      <tr key={year} className="hover:bg-slate-50/50">
                        <td className="py-1 px-2 font-bold text-left text-slate-800 bg-slate-50/30">
                          {year}
                        </td>
                        {monthTds}
                        <td
                          className={`py-1 px-2 font-bold text-right tabular-nums bg-slate-50/50 ${
                            isYearPos
                              ? 'text-teal-700'
                              : yearTotalPct < 0
                              ? 'text-rose-700'
                              : 'text-slate-400'
                          }`}
                        >
                          {hasTradesInYear ? formatSignedPct(yearTotalPct) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
