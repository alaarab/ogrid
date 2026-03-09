import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';

interface StockRow {
  id: number;
  ticker: string;
  company: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  marketCap: number;
  sector: string;
}

const INITIAL_STOCKS: StockRow[] = [
  { id: 1,  ticker: 'AAPL',  company: 'Apple Inc.',            price: 189.45, change:  2.31, changePct:  1.24, volume: 58_200_000, marketCap: 2_940_000_000_000, sector: 'Technology'    },
  { id: 2,  ticker: 'MSFT',  company: 'Microsoft Corp.',       price: 415.20, change:  5.87, changePct:  1.43, volume: 22_100_000, marketCap: 3_090_000_000_000, sector: 'Technology'    },
  { id: 3,  ticker: 'GOOGL', company: 'Alphabet Inc.',         price: 175.80, change: -1.22, changePct: -0.69, volume: 24_500_000, marketCap: 2_190_000_000_000, sector: 'Technology'    },
  { id: 4,  ticker: 'AMZN',  company: 'Amazon.com Inc.',       price: 198.35, change:  3.15, changePct:  1.61, volume: 31_700_000, marketCap: 2_090_000_000_000, sector: 'Consumer Disc.' },
  { id: 5,  ticker: 'NVDA',  company: 'NVIDIA Corp.',          price: 875.40, change: 18.90, changePct:  2.21, volume: 41_300_000, marketCap: 2_150_000_000_000, sector: 'Technology'    },
  { id: 6,  ticker: 'TSLA',  company: 'Tesla Inc.',            price: 242.10, change: -4.55, changePct: -1.84, volume: 89_400_000, marketCap:  773_000_000_000, sector: 'Automotive'    },
  { id: 7,  ticker: 'META',  company: 'Meta Platforms Inc.',   price: 512.70, change:  8.30, changePct:  1.65, volume: 18_600_000, marketCap: 1_310_000_000_000, sector: 'Technology'    },
  { id: 8,  ticker: 'BRK.B', company: 'Berkshire Hathaway',    price: 408.90, change:  1.10, changePct:  0.27, volume:  4_200_000, marketCap:  898_000_000_000, sector: 'Financials'    },
  { id: 9,  ticker: 'JPM',   company: 'JPMorgan Chase & Co.', price: 218.45, change:  3.20, changePct:  1.49, volume: 12_800_000, marketCap:  626_000_000_000, sector: 'Financials'    },
  { id: 10, ticker: 'V',     company: 'Visa Inc.',             price: 278.30, change: -0.85, changePct: -0.30, volume:  7_900_000, marketCap:  571_000_000_000, sector: 'Financials'    },
  { id: 11, ticker: 'JNJ',   company: 'Johnson & Johnson',    price: 152.75, change: -0.40, changePct: -0.26, volume:  6_100_000, marketCap:  367_000_000_000, sector: 'Healthcare'    },
  { id: 12, ticker: 'UNH',   company: 'UnitedHealth Group',   price: 528.60, change:  6.80, changePct:  1.30, volume:  3_400_000, marketCap:  495_000_000_000, sector: 'Healthcare'    },
  { id: 13, ticker: 'XOM',   company: 'Exxon Mobil Corp.',    price: 114.20, change: -1.35, changePct: -1.17, volume: 17_200_000, marketCap:  456_000_000_000, sector: 'Energy'        },
  { id: 14, ticker: 'WMT',   company: 'Walmart Inc.',          price: 181.90, change:  2.05, changePct:  1.14, volume:  9_800_000, marketCap:  490_000_000_000, sector: 'Consumer Stap.'},
  { id: 15, ticker: 'PG',    company: 'Procter & Gamble Co.', price: 165.40, change:  0.75, changePct:  0.46, volume:  5_600_000, marketCap:  389_000_000_000, sector: 'Consumer Stap.'},
  { id: 16, ticker: 'MA',    company: 'Mastercard Inc.',       price: 478.15, change:  7.25, changePct:  1.54, volume:  4_100_000, marketCap:  455_000_000_000, sector: 'Financials'    },
  { id: 17, ticker: 'HD',    company: 'Home Depot Inc.',       price: 374.20, change: -2.80, changePct: -0.74, volume:  3_700_000, marketCap:  371_000_000_000, sector: 'Consumer Disc.' },
  { id: 18, ticker: 'AVGO',  company: 'Broadcom Inc.',        price: 1298.50, change: 24.30, changePct:  1.91, volume:  5_900_000, marketCap:  605_000_000_000, sector: 'Technology'    },
];

const SECTORS = ['All', 'Technology', 'Financials', 'Healthcare', 'Consumer Disc.', 'Consumer Stap.', 'Energy', 'Automotive'];

function tickStock(stock: StockRow): StockRow {
  if (Math.random() > 0.4) {
    const volatility = stock.price * 0.003;
    const delta = (Math.random() - 0.48) * volatility;
    const newPrice = Math.max(1, stock.price + delta);
    const newChange = stock.change + delta;
    const newChangePct = (newChange / (newPrice - newChange)) * 100;
    const newVolume = Math.random() > 0.7
      ? stock.volume + Math.floor(Math.random() * 500_000)
      : stock.volume;

    return {
      ...stock,
      price: parseFloat(newPrice.toFixed(2)),
      change: parseFloat(newChange.toFixed(2)),
      changePct: parseFloat(newChangePct.toFixed(2)),
      volume: newVolume,
    };
  }
  return stock;
}

const toolbarBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '4px 10px', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit',
  color: 'var(--ogrid-fg, #242424)', background: 'transparent',
  border: '1px solid var(--ogrid-border, #e0e0e0)', borderRadius: 4,
  cursor: 'pointer', whiteSpace: 'nowrap',
};

export default function LiveDataDemo() {
  const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
  type IFilters = import('@alaarab/ogrid-react-radix').IFilters;

  const [data, setData] = useState<StockRow[]>(() => [...INITIAL_STOCKS]);
  const [paused, setPaused] = useState(false);
  const [filters, setFilters] = useState<IFilters>({});
  const pausedRef = useRef(false);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Live tick loop
  useEffect(() => {
    const interval = setInterval(() => {
      if (pausedRef.current) return;
      setData(prev => {
        const next = [...prev];
        const count = 4 + Math.floor(Math.random() * 6);
        const indices = new Set<number>();
        while (indices.size < Math.min(count, next.length)) {
          indices.add(Math.floor(Math.random() * next.length));
        }
        indices.forEach(i => { next[i] = tickStock(next[i]); });
        return next;
      });
    }, 250);
    return () => clearInterval(interval);
  }, []);

  const greenOrRed = useCallback((item: StockRow) => {
    return { color: item.change >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 } as React.CSSProperties;
  }, []);

  const columns = useMemo(() => [
    { columnId: 'ticker', name: 'Ticker', sortable: true, minWidth: 80, cellStyle: (_item: StockRow) => ({ fontWeight: 700 }) as React.CSSProperties },
    { columnId: 'company', name: 'Company', sortable: true, minWidth: 160 },
    {
      columnId: 'price', name: 'Price', type: 'numeric' as const, sortable: true, minWidth: 100,
      valueFormatter: (v: unknown) => v != null ? `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '',
      cellStyle: greenOrRed,
    },
    {
      columnId: 'change', name: 'Change', type: 'numeric' as const, sortable: true, minWidth: 90,
      valueFormatter: (v: unknown) => { const n = Number(v); return `${n >= 0 ? '+' : ''}${n.toFixed(2)}`; },
      cellStyle: greenOrRed,
    },
    {
      columnId: 'changePct', name: 'Change %', type: 'numeric' as const, sortable: true, minWidth: 95,
      valueFormatter: (v: unknown) => { const n = Number(v); return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`; },
      cellStyle: greenOrRed,
    },
    {
      columnId: 'volume', name: 'Volume', type: 'numeric' as const, sortable: true, minWidth: 90,
      valueFormatter: (v: unknown) => {
        const n = Number(v);
        if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
        if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`;
        return String(n);
      },
    },
    {
      columnId: 'marketCap', name: 'Market Cap', type: 'numeric' as const, sortable: true, minWidth: 110,
      valueFormatter: (v: unknown) => {
        const n = Number(v);
        if (n >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(2)}T`;
        if (n >= 1_000_000_000)     return `$${(n / 1_000_000_000).toFixed(0)}B`;
        return `$${(n / 1_000_000).toFixed(0)}M`;
      },
    },
    {
      columnId: 'sector', name: 'Sector', sortable: true, minWidth: 140,
      filterable: { type: 'multiSelect' as const },
    },
  ], [greenOrRed]);

  const toolbar = useMemo(() => (
    <>
      <span style={{ fontWeight: 700, fontSize: 13, marginRight: 8 }}>Market Watch</span>
      <span style={{ fontSize: 11, opacity: 0.6, marginRight: 16 }}>Real-time quotes</span>
      <button
        style={{
          ...toolbarBtnStyle,
          background: paused ? 'var(--ogrid-selection, #217346)' : 'transparent',
          color: paused ? 'white' : 'var(--ogrid-fg, #242424)',
        }}
        onClick={() => setPaused(p => !p)}
      >
        {paused ? 'Resume' : 'Pause'}
      </button>
    </>
  ), [paused]);

  return (
    <div style={{ height: 520, borderRadius: 8, overflow: 'hidden' }}>
      <OGrid
        columns={columns}
        data={data}
        getRowId={(row: StockRow) => row.id}
        cellSelection
        statusBar
        toolbar={toolbar}
        filters={filters}
        onFiltersChange={setFilters}
        defaultSortField="ticker"
        defaultSortDirection="asc"
        defaultPageSize={100}
        entityLabelPlural="stocks"
      />
    </div>
  );
}
