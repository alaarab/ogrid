import { LiveDemo } from '../../LiveDemo';
import styles from './headless.module.css';
import { columns, formatCell, getRowId, isNumeric, rows } from './headlessDemoData';

function Inner() {
  const { useHeadlessGrid } = require('@alaarab/ogrid-react') as typeof import('@alaarab/ogrid-react');

  const grid = useHeadlessGrid({
    columns,
    data: rows,
    getRowId,
    initialSort: { field: 'name', direction: 'asc' },
    initialPageSize: 10,
  });

  const nameFilter = grid.filters.name;
  const nameText = nameFilter?.type === 'text' ? nameFilter.value : '';
  const first = grid.rows.length === 0 ? 0 : (grid.page - 1) * (grid.pageSize === 'all' ? 0 : grid.pageSize) + 1;
  const last = first === 0 ? 0 : first + grid.rows.length - 1;
  const allOnPageSelected = grid.rows.length > 0 && grid.rows.every(grid.isRowSelected);

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <input
          className={styles.input}
          placeholder="Filter by name"
          value={nameText}
          onChange={(e) => grid.setFilter('name', e.target.value ? { type: 'text', value: e.target.value } : undefined)}
        />
        <select
          className={styles.input}
          value={String(grid.pageSize)}
          onChange={(e) => grid.setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))}
        >
          <option value="5">5 / page</option>
          <option value="10">10 / page</option>
          <option value="25">25 / page</option>
          <option value="all">All</option>
        </select>
        <button type="button" className={styles.btn} onClick={() => grid.setSort({ field: '', direction: 'asc' })} disabled={!grid.sort.field}>
          Clear sort
        </button>
        <button type="button" className={styles.btn} onClick={grid.clearSelection} disabled={grid.selectedRowIds.size === 0}>
          Clear selection ({grid.selectedRowIds.size})
        </button>
        <span className={styles.status}>
          {first}–{last} of {grid.totalCount}
          {grid.hasActiveFilters ? ' (filtered)' : ''}
        </span>
      </div>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th} style={{ width: 32 }}>
                <input
                  type="checkbox"
                  aria-label="Select all rows on this page"
                  checked={allOnPageSelected}
                  onChange={() => (allOnPageSelected ? grid.clearSelection() : grid.selectAllOnPage())}
                />
              </th>
              {grid.columns.map((col) => (
                <th
                  key={col.columnId}
                  className={styles.th}
                  aria-sort={grid.sort.field === col.columnId ? (grid.sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {col.sortable ? (
                    <button type="button" className={styles.sortBtn} onClick={() => grid.toggleSort(col.columnId)}>
                      {col.name} {grid.sortIndicator(col.columnId)}
                    </button>
                  ) : (
                    col.name
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => (
              <tr key={grid.getRowId(row)} className={grid.isRowSelected(row) ? styles.selectedRow : undefined}>
                <td className={styles.td}>
                  <input type="checkbox" aria-label={`Select ${row.name}`} checked={grid.isRowSelected(row)} onChange={() => grid.toggleRowSelection(row)} />
                </td>
                {grid.columns.map((col) => (
                  <td key={col.columnId} className={`${styles.td} ${isNumeric(col) ? styles.numeric : ''}`}>
                    {formatCell(col, grid.getCellValue(row, col.columnId), row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.toolbar}>
        <button type="button" className={styles.btn} onClick={() => grid.setPage(grid.page - 1)} disabled={grid.page <= 1}>
          Previous
        </button>
        <span>
          Page {grid.page} of {grid.totalPages}
        </span>
        <button type="button" className={styles.btn} onClick={() => grid.setPage(grid.page + 1)} disabled={grid.page >= grid.totalPages}>
          Next
        </button>
      </div>
    </div>
  );
}

export default function UseHeadlessGridDemo() {
  return (
    <LiveDemo height={460} title="Plain <table> driven by useHeadlessGrid: click headers to sort, filter, paginate, select rows">
      {() => <Inner />}
    </LiveDemo>
  );
}
