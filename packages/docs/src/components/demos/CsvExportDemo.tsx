import { useCallback, useMemo } from 'react';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, paginationColumns, btnStyle, type Person } from './demoData';

function Inner() {
  const { OGrid, exportToCsv } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
  type CsvColumn = import('@alaarab/ogrid-react-radix').CsvColumn;

  const csvColumns: CsvColumn[] = useMemo(
    () => paginationColumns.map(c => ({ columnId: c.columnId, name: c.name })),
    []
  );

  const handleExport = useCallback(() => {
    exportToCsv<Person>(
      people,
      csvColumns,
      (item, columnId) => String((item as Record<string, unknown>)[columnId] ?? ''),
      'people.csv'
    );
  }, [exportToCsv, csvColumns]);

  return (
    <OGrid
      columns={paginationColumns}
      data={people}
      getRowId={getRowId}
      toolbar={<button type="button" onClick={handleExport} style={btnStyle}>Export to CSV</button>}
      defaultPageSize={10}
    />
  );
}

export default function CsvExportDemo() {
  return (
    <LiveDemo height={420} title="Click 'Export to CSV' to download the data">
      {() => <Inner />}
    </LiveDemo>
  );
}
