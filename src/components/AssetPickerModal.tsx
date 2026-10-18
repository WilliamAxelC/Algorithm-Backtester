import React, { useState, useMemo, useRef } from 'react';
import { Search, X, Check, Upload, AlertCircle, FileText } from 'lucide-react';
import type { AssetMetadata, MarketDataset } from '../types/market';
import { ASSET_CATALOG } from '../data/asset-catalog';
import { parseCustomCsvDataset } from '../data/csv-loader';

export interface AssetPickerModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSelectAsset: (asset: AssetMetadata) => void;
  readonly selectedSymbol: string;
  readonly onCustomCsvLoaded?: (dataset: MarketDataset) => void;
}

type CategoryTab = 'ALL' | 'CRYPTO' | 'IDX_LQ45' | 'US_EQUITY';

export const AssetPickerModal: React.FC<AssetPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectAsset,
  selectedSymbol,
  onCustomCsvLoaded,
}) => {
  const [activeTab, setActiveTab] = useState<CategoryTab>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => {
    let all = 0;
    let crypto = 0;
    let idx = 0;
    let us = 0;
    for (const asset of ASSET_CATALOG) {
      all++;
      if (asset.assetClass === 'CRYPTO') crypto++;
      else if (asset.assetClass === 'IDX_LQ45') idx++;
      else if (asset.assetClass === 'US_EQUITY') us++;
    }
    return { all, crypto, idx, us };
  }, []);

  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ASSET_CATALOG.filter((asset) => {
      // Category filter
      if (activeTab === 'CRYPTO' && asset.assetClass !== 'CRYPTO') return false;
      if (activeTab === 'IDX_LQ45' && asset.assetClass !== 'IDX_LQ45') return false;
      if (activeTab === 'US_EQUITY' && asset.assetClass !== 'US_EQUITY') return false;

      // Text search
      if (q.length === 0) return true;
      return (
        asset.symbol.toLowerCase().includes(q) ||
        asset.name.toLowerCase().includes(q) ||
        asset.sector.toLowerCase().includes(q) ||
        asset.exchange.toLowerCase().includes(q)
      );
    });
  }, [activeTab, searchQuery]);

  if (!isOpen) {
    return null;
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result;
        if (typeof content !== 'string') {
          setUploadError('Failed to read CSV content: expected text.');
          return;
        }

        const baseName = file.name.replace(/\.[^/.]+$/, '').toUpperCase();
        const isIdr = baseName.endsWith('.JK');
        const currency = isIdr ? 'IDR' : 'USD';

        const dataset = parseCustomCsvDataset(content, baseName, currency);
        if (dataset.asset !== undefined) {
          onCustomCsvLoaded?.(dataset);
          onSelectAsset(dataset.asset);
          onClose();
        } else {
          setUploadError('Unable to construct asset metadata from CSV.');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Invalid CSV file format';
        setUploadError(msg);
      }
    };
    reader.onerror = () => {
      setUploadError('FileReader encountered an error reading the file.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getExchangeBadge = (asset: AssetMetadata): React.ReactNode => {
    if (asset.exchange === 'IDX') {
      return (
        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-medium px-2 py-0.5 rounded">
          IDX · IDR
        </span>
      );
    }
    if (asset.exchange === 'BINANCE') {
      return (
        <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-mono font-medium px-2 py-0.5 rounded">
          BINANCE · USD
        </span>
      );
    }
    return (
      <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-mono font-medium px-2 py-0.5 rounded">
        {asset.exchange} · USD
      </span>
    );
  };

  const getLotSizeInfo = (asset: AssetMetadata): string => {
    if (asset.assetClass === 'IDX_LQ45') {
      return '1 Lot = 100 Shares';
    }
    if (asset.assetClass === 'CRYPTO') {
      return `${asset.lotSize}`;
    }
    return '1 Share';
  };

  const getFeeInfo = (asset: AssetMetadata): string => {
    if (asset.buyFeeBps === asset.sellFeeBps) {
      return `${(asset.buyFeeBps / 100).toFixed(2)}%`;
    }
    return `${(asset.buyFeeBps / 100).toFixed(2)}% / ${(asset.sellFeeBps / 100).toFixed(2)}%`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none"
    >
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* =================================================================== */}
        {/* Header: Title, Description, and Close Button                         */}
        {/* =================================================================== */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Select Market Asset
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose from 14 curated multi-asset liquid instruments or import custom OHLCV data
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* =================================================================== */}
        {/* Search Bar                                                          */}
        {/* =================================================================== */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-100">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by symbol, company, or sector..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
              autoFocus
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* =================================================================== */}
        {/* Category Filter Tabs                                                */}
        {/* =================================================================== */}
        <div className="px-5 border-b border-slate-200 flex items-center gap-6 bg-slate-50/50">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'ALL'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('CRYPTO')}
            className={`py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'CRYPTO'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Crypto Perps & Spot ({counts.crypto})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('IDX_LQ45')}
            className={`py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'IDX_LQ45'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Indonesia LQ45 ({counts.idx})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('US_EQUITY')}
            className={`py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'US_EQUITY'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            US Equities & ETFs ({counts.us})
          </button>
        </div>

        {/* =================================================================== */}
        {/* Scrollable Asset List                                               */}
        {/* =================================================================== */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-3">
          {filteredAssets.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No assets found matching &ldquo;{searchQuery}&rdquo;
            </div>
          ) : (
            filteredAssets.map((asset) => {
              const isSelected =
                asset.symbol.toUpperCase() === selectedSymbol.toUpperCase();
              const schematicLabel =
                asset.wyckoffVariant === 'SCHEMATIC_1_SPRING'
                  ? 'Schematic #1 (Spring)'
                  : 'Schematic #2 (LPS)';

              return (
                <div
                  key={asset.symbol}
                  onClick={() => {
                    onSelectAsset(asset);
                    onClose();
                  }}
                  className={`p-3 rounded transition-all cursor-pointer flex items-center justify-between gap-4 ${
                    isSelected
                      ? 'border border-blue-600 bg-blue-50/40 ring-1 ring-blue-600'
                      : 'border border-transparent hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {/* Left Column: Symbol, Name, Sector */}
                  <div className="flex flex-col min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-slate-900">
                        {asset.symbol}
                      </span>
                      {isSelected && (
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold text-blue-600 bg-blue-100/70 px-1.5 py-0.2 rounded">
                          <Check className="w-3 h-3" />
                          <span>Active</span>
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-600 font-sans truncate">
                      {asset.name}
                    </span>
                    <span className="text-[11px] text-slate-400 font-sans">
                      {asset.sector}
                    </span>
                  </div>

                  {/* Badges & Microstructure Details */}
                  <div className="flex items-center gap-3 flex-wrap justify-end">
                    {/* Exchange & Currency badge */}
                    {getExchangeBadge(asset)}

                    {/* Lot Size info */}
                    <div className="text-right flex flex-col">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                        Lot Size
                      </span>
                      <span className="font-mono text-[11px] text-slate-700">
                        {getLotSizeInfo(asset)}
                      </span>
                    </div>

                    {/* Wyckoff Schematic tag */}
                    <div className="text-right flex flex-col">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                        Wyckoff Target
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                        {schematicLabel}
                      </span>
                    </div>

                    {/* Fee structure info */}
                    <div className="text-right flex flex-col min-w-[70px]">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                        Fees
                      </span>
                      <span className="font-mono text-[11px] text-slate-700">
                        {getFeeInfo(asset)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* =================================================================== */}
        {/* Footer: Upload Custom CSV and Status                                */}
        {/* =================================================================== */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <FileText className="w-4 h-4 text-slate-400" />
            <span>
              Supports TradingView, Yahoo Finance, or IDX CSV (10+ daily/hourly bars)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv,text/csv"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>Import Custom CSV</span>
            </button>
          </div>
        </div>

        {/* Upload Error Banner */}
        {uploadError !== null && (
          <div className="px-5 py-2 bg-rose-50 border-t border-rose-200 flex items-center gap-2 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{uploadError}</span>
            <button
              type="button"
              onClick={() => setUploadError(null)}
              className="text-rose-500 hover:text-rose-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
