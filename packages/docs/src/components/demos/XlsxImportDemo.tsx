import React from 'react';
import { LiveDemo } from '../LiveDemo';

/**
 * Builds a formatted two-sheet workbook in the browser with ExcelJS, then
 * renders it with XlsxWorkbookGrid: the same path a real .xlsx upload takes,
 * minus the file input. Editing, the formatting toolbar and Export are on.
 */
export default function XlsxImportDemo() {
  return (
    <LiveDemo height={500} title="A formatted two-sheet workbook built in-browser: edit, format, export">
      {() => {
        const { XlsxWorkbookGrid } = require('@alaarab/ogrid-react-xlsx') as typeof import('@alaarab/ogrid-react-xlsx');
        const ExcelJS = require('exceljs') as typeof import('exceljs');

        function WorkbookDemo() {
          const [workbook, setWorkbook] = React.useState<import('exceljs').Workbook | null>(null);

          React.useEffect(() => {
            const wb = new ExcelJS.Workbook();
            const orders = wb.addWorksheet('Orders', { properties: { tabColor: { argb: 'FF217346' } } });
            orders.addRow(['Order', 'Customer', 'Amount', 'Discount', 'Status']);
            for (let i = 1; i <= 40; i++) {
              const r = orders.addRow([
                1000 + i,
                ['Acme Co', 'Globex', 'Initech', 'Umbrella'][i % 4],
                125 + (i % 9) * 50,
                (i % 4) * 0.05,
                ['Paid', 'Pending', 'Shipped'][i % 3],
              ]);
              r.getCell(3).numFmt = '"$"#,##0.00';
              r.getCell(4).numFmt = '0%';
              r.getCell(5).dataValidation = { type: 'list', formulae: ['"Paid,Pending,Shipped"'] };
              if (i % 3 === 1) r.getCell(5).font = { bold: true, color: { argb: 'FF217346' } };
            }
            orders.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
            orders.getColumn(2).width = 16;
            orders.getColumn(3).width = 14;

            const summary = wb.addWorksheet('Summary');
            summary.addRow(['Metric', 'Value']);
            summary.addRow(['Orders', { formula: 'COUNT(Orders!A2:A41)', result: 40 }]);
            summary.addRow(['Revenue', { formula: 'SUM(Orders!C2:C41)', result: 13000 }]);
            summary.getCell('B3').numFmt = '"$"#,##0.00';
            summary.getCell('B3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
            setWorkbook(wb);
          }, []);

          if (!workbook) return <div style={{ padding: 16 }}>Building workbook…</div>;
          return <XlsxWorkbookGrid workbook={workbook} height={480} editable exportFileName="orders.xlsx" />;
        }

        return <WorkbookDemo />;
      }}
    </LiveDemo>
  );
}
