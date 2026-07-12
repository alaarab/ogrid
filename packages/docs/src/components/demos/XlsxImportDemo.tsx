import React from 'react';
import { LiveDemo } from '../LiveDemo';

/**
 * Builds a two-sheet workbook in the browser with ExcelJS, then renders it
 * with XlsxWorkbookGrid — the same path a real .xlsx upload takes, minus the
 * file input.
 */
export default function XlsxImportDemo() {
  return (
    <LiveDemo height={460} title="A two-sheet workbook built in-browser, rendered with XlsxWorkbookGrid">
      {() => {
        const { XlsxWorkbookGrid } = require('@alaarab/ogrid-react-xlsx') as typeof import('@alaarab/ogrid-react-xlsx');
        const ExcelJS = require('exceljs') as typeof import('exceljs');

        function WorkbookDemo() {
          const [workbook, setWorkbook] = React.useState<import('exceljs').Workbook | null>(null);

          React.useEffect(() => {
            const wb = new ExcelJS.Workbook();
            const orders = wb.addWorksheet('Orders');
            orders.addRow(['Order', 'Customer', 'Amount', 'Status']);
            for (let i = 1; i <= 40; i++) {
              orders.addRow([
                1000 + i,
                ['Acme Co', 'Globex', 'Initech', 'Umbrella'][i % 4],
                125 + (i % 9) * 50,
                ['Paid', 'Pending', 'Shipped'][i % 3],
              ]);
            }
            const summary = wb.addWorksheet('Summary');
            summary.addRow(['Metric', 'Value']);
            summary.addRow(['Orders', 40]);
            summary.addRow(['Revenue', { formula: 'B2*325', result: 13000 }]);
            setWorkbook(wb);
          }, []);

          if (!workbook) return <div style={{ padding: 16 }}>Building workbook…</div>;
          return <XlsxWorkbookGrid workbook={workbook} height={420} />;
        }

        return <WorkbookDemo />;
      }}
    </LiveDemo>
  );
}
