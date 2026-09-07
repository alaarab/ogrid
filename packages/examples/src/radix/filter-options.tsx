import { useState } from 'react';
import type { PageSize } from '@alaarab/ogrid-core';
import { createRoot } from 'react-dom/client';
import { OGrid, ColumnHeaderFilter, ColumnChooser, PaginationControls, type IColumnDef } from '@alaarab/ogrid-react-radix';
import './filter-options.css';

const rows = [{ id: 1, name: 'Current project', active: true }, { id: 2, name: 'Past project', active: false }];
const columns: IColumnDef[] = [
  { columnId: 'name', name: 'Project' },
  { columnId: 'active', name: 'Status', valueFormatter: (value) => value ? 'Active' : 'Inactive',
    filterable: { type: 'multiSelect', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] } },
];
const manyOptions = Array.from({ length: 60 }, (_, i) => ({ value: String(i), label: `Choice ${i + 1}` }));

function App() {
  const [filters, setFilters] = useState({});
  const [selected, setSelected] = useState<string[]>([]);
  const [visible, setVisible] = useState(new Set(['name', 'active']));
  const [page, setPage] = useState(10);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  return <main className="theme-scope" data-theme="dark">
    <h1>Filter labels and scoped themes</h1>
    <OGrid columns={columns} data={rows} getRowId={(row) => (row as (typeof rows)[number]).id} filters={filters} onFiltersChange={setFilters} columnChooser={false} defaultPageSize={1} pageSizeOptions={[1, 'all']} />
    <output data-testid="filters">{JSON.stringify(filters)}</output>
    <section aria-label="Many options">
      <ColumnHeaderFilter columnKey="choice" columnName="Choice" filterType="multiSelect" options={manyOptions} selectedValues={selected} onFilterChange={setSelected} />
      <output data-testid="selection">{JSON.stringify(selected)}</output>
    </section>
    <section aria-label="Column chooser">
      <ColumnChooser columns={columns} visibleColumns={visible} onVisibilityChange={(key, show) => setVisible((old) => {
        const next = new Set(old);
        if (show) next.add(key); else next.delete(key);
        return next;
      })} onSetVisibleColumns={setVisible} />
    </section>
    <section aria-label="Many pages">
      <PaginationControls currentPage={page} pageSize={pageSize} totalCount={1000} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} pageSizeOptions={[25, 50, 'all']} />
    </section>
  </main>;
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
