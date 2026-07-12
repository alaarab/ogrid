// XLSX example mode (?xlsx=1): builds a two-sheet workbook in the browser
// with ExcelJS and renders it through XlsxWorkbookGrid — exercising the
// same parse/map path an uploaded .xlsx file takes.

import React from 'react';
import ExcelJS from 'exceljs';
import { XlsxWorkbookGrid } from '@alaarab/ogrid-react-xlsx';

function buildDemoWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const orders = wb.addWorksheet('Orders');
  orders.addRow(['Order', 'Customer', 'Amount', 'Status']);
  for (let i = 1; i <= 30; i++) {
    orders.addRow([
      1000 + i,
      ['Acme Co', 'Globex', 'Initech', 'Umbrella'][i % 4],
      125 + (i % 9) * 50,
      ['Paid', 'Pending', 'Shipped'][i % 3],
    ]);
  }
  const summary = wb.addWorksheet('Summary');
  summary.addRow(['Metric', 'Value']);
  summary.addRow(['Orders', 30]);
  summary.addRow(['Average', { formula: 'B2/2', result: 15 }]);
  return wb;
}

export function XlsxExample() {
  const workbook = React.useMemo(buildDemoWorkbook, []);
  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }} data-testid="xlsx-example">
      <h1>OGrid - XLSX Example</h1>
      <p style={{ color: 'var(--ogrid-fg-secondary, #666)', marginBottom: 16 }}>
        A two-sheet workbook rendered with <code>XlsxWorkbookGrid</code> from{' '}
        <code>@alaarab/ogrid-react-xlsx</code>.
      </p>
      <XlsxWorkbookGrid workbook={workbook} height={560} />
    </div>
  );
}
