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
        const { XlsxWorkbookGrid, exportToXlsx } = require('@alaarab/ogrid-react-xlsx') as typeof import('@alaarab/ogrid-react-xlsx');
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

          const handleExport = () => {
            const orders = workbook.getWorksheet('Orders');
            if (!orders) return;
            const rows: Array<Record<string, unknown>> = [];
            orders.eachRow((row, rowNumber) => {
              if (rowNumber === 1) return; // header
              rows.push({
                order: row.getCell(1).value,
                customer: row.getCell(2).value,
                amount: row.getCell(3).value,
                status: row.getCell(4).value,
              });
            });
            void exportToXlsx(
              rows,
              [
                { columnId: 'order', name: 'Order' },
                { columnId: 'customer', name: 'Customer' },
                { columnId: 'amount', name: 'Amount' },
                { columnId: 'status', name: 'Status' },
              ],
              (item, columnId) => item[columnId],
              'orders.xlsx',
              { sheetName: 'Orders' },
            );
          };

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
              <div>
                <button
                  type="button"
                  onClick={handleExport}
                  style={{ padding: '4px 12px', fontSize: 13, cursor: 'pointer' }}
                >
                  Export .xlsx
                </button>
              </div>
              <XlsxWorkbookGrid workbook={workbook} height={380} />
            </div>
          );
        }

        return <WorkbookDemo />;
      }}
    </LiveDemo>
  );
}
