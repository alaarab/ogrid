import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { OGrid, type IColumnDef } from '@alaarab/ogrid-react-fluent';

// Fluent counterpart of ../radix/filter-options.tsx for the kit-agnostic
// labeled-filter cases in e2e/radixFilters.spec.ts. The Radix page's scoped
// --ogrid-* theme and mobile sections have no Fluent equivalent: Fluent takes
// its colors from the FluentProvider theme.
const rows = [{ id: 1, name: 'Current project', active: true }, { id: 2, name: 'Past project', active: false }];
const columns: IColumnDef[] = [
  { columnId: 'name', name: 'Project' },
  { columnId: 'active', name: 'Status', valueFormatter: (value) => value ? 'Active' : 'Inactive',
    filterable: { type: 'multiSelect', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] } },
];

function App() {
  const [filters, setFilters] = useState({});
  return <FluentProvider theme={webLightTheme}>
    <main>
      <h1>Filter labels</h1>
      <OGrid columns={columns} data={rows} getRowId={(row) => (row as (typeof rows)[number]).id} filters={filters} onFiltersChange={setFilters} columnChooser={false} defaultPageSize={1} pageSizeOptions={[1, 'all']} />
      <output data-testid="filters">{JSON.stringify(filters)}</output>
    </main>
  </FluentProvider>;
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
