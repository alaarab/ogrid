import React, { useCallback } from 'react';
import { OGrid, exportToCsv } from '@alaarab/ogrid';
import type { CsvColumn } from '@alaarab/ogrid';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, paginationColumns, btnStyle, type Person } from './demoData';

const csvColumns: CsvColumn[] = paginationColumns.map(c => ({ columnId: c.columnId, name: c.name }));

export default function CsvExportDemo() {
  const handleExport = useCallback(() => {
    exportToCsv<Person>(
      people,
      csvColumns,
      (item, columnId) => String((item as Record<string, unknown>)[columnId] ?? ''),
      'people.csv'
    );
  }, []);

  return (
    <LiveDemo height={420} title="Click 'Export to CSV' to download the data">
      <OGrid
        columns={paginationColumns}
        data={people}
        getRowId={getRowId}
        toolbar={<button onClick={handleExport} style={btnStyle}>Export to CSV</button>}
        defaultPageSize={10}
      />
    </LiveDemo>
  );
}
