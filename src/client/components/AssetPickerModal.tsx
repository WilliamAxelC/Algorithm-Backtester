import React, { useMemo, useState } from 'react';
import { Globe, Search, Shield, X } from 'lucide-react';
import type { AssetClass, AssetMetadata } from '../../shared/types/market';
import { ASSET_CATALOG } from '../../shared/catalog/asset-catalog';

interface AssetPickerModalProps {
  readonly isOpen: boolean;
  readonly activeSymbol: string;
  readonly onClose: () => void;
  readonly onSelectAsset: (symbol: string) => void;
}

type TabFilter = 'ALL' | AssetClass;

export const AssetPickerModal: React.FC<AssetPickerModalProps> = ({
  isOpen,
  activeSymbol,
  onClose,
  onSelectAsset,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<TabFilter>('ALL');

  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ASSET_CATALOG.filter((item) => {
      // Tab filter
      if (selectedTab !== 'ALL' && item.assetClass !== selectedTab) {
        return false;
      }
      // Search query
      if (!q) return true;
      return (
        item.symbol.toLowerCase().includes(q) ||
        item.providerSymbol.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.sector.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, selectedTab]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="asset-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-600" />
            <h2 id="asset-modal-title" className="font-mono text-sm font-bold text-slate-900 tracking-tight">
              SELECT ASSET — REAL-MARKET 10Y CATALOG (73 ASSETS)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Tabs Strip */}
        <div className="p-4 border-b border-slate-200 space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              autoFocus
              placeholder="Search by ticker, company name, or sector (e.g. BBCA, NVDA, HNT, Banking, Energy)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
            />
          </div>

          {/* Segmented Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setSelectedTab('ALL')}
              className={`px-3 py-1 rounded font-mono text-[11px] font-semibold transition-colors ${
                selectedTab === 'ALL'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Assets (73)
            </button>
            <button
              type="button"
              onClick={() => setSelectedTab('IDX_LQ45')}
              className={`px-3 py-1 rounded font-mono text-[11px] font-semibold transition-colors ${
                selectedTab === 'IDX_LQ45'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Indonesia LQ45 (45)
            </button>
            <button
              type="button"
              onClick={() => setSelectedTab('US_EQUITY')}
              className={`px-3 py-1 rounded font-mono text-[11px] font-semibold transition-colors ${
                selectedTab === 'US_EQUITY'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              US Equities & ETFs (20)
            </button>
            <button
              type="button"
              onClick={() => setSelectedTab('CRYPTO')}
              className={`px-3 py-1 rounded font-mono text-[11px] font-semibold transition-colors ${
                selectedTab === 'CRYPTO'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Crypto Spot & Perps (8)
            </button>
          </div>
        </div>

        {/* Scrollable Asset List */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
          {filteredAssets.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-mono text-xs">
              No assets found matching &ldquo;{searchQuery}&rdquo;
            </div>
          ) : (
            filteredAssets.map((asset: AssetMetadata) => {
              const isSelected = asset.symbol === activeSymbol;
              return (
                <button
                  key={asset.symbol}
                  type="button"
                  onClick={() => {
                    onSelectAsset(asset.symbol);
                    onClose();
                  }}
                  className={`w-full py-2.5 px-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors rounded ${
                    isSelected ? 'bg-blue-50/70 border-l-2 border-blue-600' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-24">
                      <span className="font-mono font-bold text-slate-900 text-xs block">
                        {asset.symbol}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono uppercase">
                        {asset.exchange} • {asset.currency}
                      </span>
                    </div>

                    <div className="max-w-md">
                      <span className="text-xs text-slate-800 font-medium line-clamp-1 block">
                        {asset.name}
                      </span>
                      <span className="text-[10px] text-slate-500 line-clamp-1">
                        {asset.sector}
                      </span>
                    </div>
                  </div>

                  {/* Microstructure Specs */}
                  <div className="flex items-center gap-2 font-mono text-[10px] text-right">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {asset.assetClass === 'IDX_LQ45'
                        ? '100 sh/lot'
                        : asset.assetClass === 'US_EQUITY'
                        ? '1 share'
                        : '0.001 lot'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      Fee: {asset.buyFeeBps}/{asset.sellFeeBps} bps
                    </span>
                    {isSelected && (
                      <span className="flex items-center gap-1 text-blue-600 font-semibold">
                        <Shield className="w-3 h-3" />
                        ACTIVE
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-[11px] font-mono text-slate-500">
          <span>
            Showing <strong className="text-slate-800">{filteredAssets.length}</strong> of 73 assets
          </span>
          <span>100% Real Historical Bars • Yahoo Finance & Binance</span>
        </div>
      </div>
    </div>
  );
};
