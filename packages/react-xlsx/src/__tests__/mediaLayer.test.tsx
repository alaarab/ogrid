import '@testing-library/jest-dom';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExcelJS from 'exceljs';
import type { IOGridApi } from '@alaarab/ogrid-core';
import { XlsxMediaLayer } from '../XlsxMediaLayer';
import { XlsxWorkbookGrid } from '../XlsxWorkbookGrid';
import { workbookFromBlob, type SheetRow } from '../sheetMapper';
import { mediaWorkbookBlob, PNG } from './fixtures/mediaWorkbook';

const sizes = { clientHeight: 300, offsetHeight: 300, clientWidth: 600, offsetWidth: 600 };
const originals = Object.keys(sizes).map((key) => [key, Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)] as const);
beforeAll(() => {
  for (const [key, value] of Object.entries(sizes)) Object.defineProperty(HTMLElement.prototype, key, { configurable: true, get: () => value });
});
afterAll(() => {
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor);
    else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[key];
  }
});
const rect = (x: number, y: number, width: number, height: number) => ({ x, y, left: x, top: y, right: x + width, bottom: y + height, width, height, toJSON: () => ({}) });

describe('XLSX media display', () => {
  function mountMedia(workbook: ExcelJS.Workbook, rows: SheetRow[], rowHeight = 20, rowHeights: Record<string, number> = {}) {
    const root = document.createElement('div');
    root.innerHTML = '<div data-ogrid-scroll-container><table><thead><tr><th data-column-id="A"></th><th data-column-id="B"></th><th data-column-id="C"></th></tr></thead><tbody><tr data-row-id="0"></tr></tbody></table></div>';
    document.body.append(root);
    const scroll = root.querySelector<HTMLElement>('[data-ogrid-scroll-container]')!;
    const sample = root.querySelector<HTMLElement>('tbody tr')!;
    root.getBoundingClientRect = scroll.getBoundingClientRect = () => rect(0, 0, 600, 300);
    root.querySelector<HTMLElement>('thead')!.getBoundingClientRect = () => rect(0, 0, 600, 40);
    let widths = [126, 64, 64];
    for (const [i, th] of Array.from(root.querySelectorAll('th')).entries()) th.getBoundingClientRect = () => rect(30 + widths.slice(0, i).reduce((a, b) => a + b, 0), 0, widths[i]!, 40);
    const currentRows = { value: rows };
    sample.getBoundingClientRect = () => rect(0, 40, 600, rowHeight);
    sample.setAttribute('data-row-id', String(rows[0]?.__rowIdx));
    const apiRef = { current: { getDisplayedRows: () => currentRows.value } as IOGridApi<SheetRow> };
    const view = render(<XlsxMediaLayer workbook={workbook} sheetName={workbook.worksheets[0]!.name} rootRef={{ current: root }} apiRef={apiRef} headerPromoted={false} rowHeight={rowHeight} rowHeights={rowHeights} />, { container: root.appendChild(document.createElement('div')) });
    return { root, changeRows: (next: SheetRow[]) => { currentRows.value = next; sample.setAttribute('data-row-id', String(next[0]?.__rowIdx)); }, resize: () => { widths = widths.map((w) => w * 2); root.querySelector('th')!.setAttribute('style', 'width:252px'); }, dispose: () => { view.unmount(); root.remove(); } };
  }

  for (const density of [1, 2]) {
    for (const kind of ['image', 'chart']) {
      test(`native OOXML ${kind} offsets use actual cell dimensions at density scale ${density}`, async () => {
        const workbook = await workbookFromBlob(await mediaWorkbookBlob({ nativeOffsets: true }));
        const fixture = mountMedia(workbook, Array.from({ length: 11 }, (_, __rowIdx) => ({ __rowIdx })), 20 * density, { '1': 40 * density });
        try {
          const media = kind === 'image' ? await screen.findByRole('img', { name: 'Image at A2' }) : await screen.findByText('Chart: Sales by Region — opens in Excel');
          const x = kind === 'image' ? 45000 / 9525 : 40;
          expect(parseFloat(media.style.left)).toBeCloseTo(30 + x, 3);
          expect(parseFloat(media.style.top)).toBeCloseTo(30 * density, 3);
          expect(parseFloat(media.style.width)).toBeCloseTo(146 - x, 3);
          expect(parseFloat(media.style.height)).toBeCloseTo(55 * density, 3);
          fixture.resize();
          await waitFor(() => expect(parseFloat(media.style.left)).toBeCloseTo(30 + x * 2, 3));
          expect(parseFloat(media.style.width)).toBeCloseTo((146 - x) * 2, 3);
        } finally { fixture.dispose(); }
      });
    }
  }

  test('native one-cell media extents scale with row density', async () => {
    const workbook = await workbookFromBlob(await mediaWorkbookBlob({ nativeOffsets: true, oneCellAnchors: true }));
    const fixture = mountMedia(workbook, Array.from({ length: 11 }, (_, __rowIdx) => ({ __rowIdx })), 40, { '1': 80 });
    try {
      const image = await screen.findByRole('img');
      const chart = await screen.findByText('Chart: Sales by Region — opens in Excel');
      expect(image).toHaveStyle({ top: '60px', width: '80px', height: '60px' });
      expect(chart).toHaveStyle({ left: '70px', top: '60px', width: '80px', height: '60px' });
    } finally { fixture.dispose(); }
  });

  test('sorting moves a two-cell image origin while retaining its positive span', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Media').addImage(workbook.addImage({ base64: PNG, extension: 'png' }), { tl: { col: 0, row: 0 }, br: { col: 1, row: 2 } });
    const rows = Array.from({ length: 3 }, (_, __rowIdx) => ({ __rowIdx }));
    const fixture = mountMedia(workbook, rows);
    try {
      const image = await screen.findByRole('img');
      expect(image).toHaveStyle({ top: '0px', height: '40px' });
      fixture.changeRows([...rows].reverse());
      await waitFor(() => expect(image).toHaveStyle({ top: '40px', height: '40px' }));
    } finally { fixture.dispose(); }
  });

  test('a visible media origin survives a missing far-edge row or column', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Media').addImage(workbook.addImage({ base64: PNG, extension: 'png' }), { tl: { nativeCol: 0, nativeRow: 0, nativeColOff: 0, nativeRowOff: 0 } as ExcelJS.Anchor, br: { nativeCol: 3, nativeRow: 3, nativeColOff: 0, nativeRowOff: 95250 } as ExcelJS.Anchor });
    const fixture = mountMedia(workbook, [{ __rowIdx: 0 }, { __rowIdx: 1 }]);
    // The fractional bottom is beyond the loaded/page/filtered row list.
    try {
      const image = await screen.findByRole('img');
      expect(image).toHaveStyle({ top: '0px', width: '254px', height: '70px' });
      fixture.root.querySelector('th[data-column-id="C"]')!.remove();
      await waitFor(() => expect(screen.getByRole('img')).toHaveStyle({ width: '254px', height: '70px' }));
    } finally { fixture.dispose(); }
  });

  test('positions fractional image anchors using resized columns and variable row heights, including unrendered rows', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Media');
    ws.addImage(wb.addImage({ base64: PNG, extension: 'png' }), { tl: { nativeCol: 0, nativeRow: 2, nativeColOff: 304800, nativeRowOff: 95250 } as ExcelJS.Anchor, br: { nativeCol: 2, nativeRow: 5, nativeColOff: 0, nativeRowOff: 0 } as ExcelJS.Anchor });
    // This is the grid's public DOM and displayed-row API. Row 2 is outside
    // the virtual window, but its image reaches into the rendered viewport.
    const root = document.createElement('div');
    root.innerHTML = '<div data-ogrid-scroll-container><table><thead><tr><th data-column-id="A"></th><th data-column-id="B"></th></tr></thead><tbody><tr data-row-id="3"></tr></tbody></table></div>';
    document.body.append(root);
    const scroll = root.querySelector<HTMLElement>('[data-ogrid-scroll-container]')!;
    const thA = root.querySelector<HTMLElement>('th[data-column-id="A"]')!;
    const thB = root.querySelector<HTMLElement>('th[data-column-id="B"]')!;
    const sample = root.querySelector<HTMLElement>('tbody tr')!;
    let width = 100;
    root.getBoundingClientRect = () => rect(0, 0, 600, 300);
    scroll.getBoundingClientRect = () => rect(0, 0, 600, 300);
    root.querySelector<HTMLElement>('thead')!.getBoundingClientRect = () => rect(0, 0, 600, 40);
    thA.getBoundingClientRect = () => rect(30 - scroll.scrollLeft, 0, width, 40);
    thB.getBoundingClientRect = () => rect(30 + width - scroll.scrollLeft, 0, 80, 40);
    sample.getBoundingClientRect = () => rect(0, 80 - scroll.scrollTop, 600, 20);
    let rows: SheetRow[] = Array.from({ length: 8 }, (_, __rowIdx) => ({ __rowIdx }));
    const apiRef = { current: { getDisplayedRows: () => rows } as IOGridApi<SheetRow> };
    const props = { workbook: wb, sheetName: 'Media', rootRef: { current: root }, apiRef, headerPromoted: false, rowHeight: 20, rowHeights: { '2': 40 } };
    const view = render(<XlsxMediaLayer {...props} />, { container: root.appendChild(document.createElement('div')) });
    const image = await screen.findByRole('img');
    expect(image).toHaveStyle({ left: '80px', top: '20px', width: '130px', height: '60px' });
    width = 200;
    thA.setAttribute('style', 'width:200px');
    await waitFor(() => expect(image).toHaveStyle({ left: '130px', width: '180px' }));
    fireEvent.scroll(scroll, { target: { scrollTop: 10, scrollLeft: 15 } });
    await waitFor(() => expect(image).toHaveStyle({ left: '115px', top: '10px' }));
    // Filtering/off-page rows disappear from getDisplayedRows, even if an
    // overscanned row remains rendered. Hidden columns have no header cell.
    rows = rows.filter((r) => r.__rowIdx !== 2);
    sample.setAttribute('data-row-id', '4');
    await waitFor(() => expect(document.querySelectorAll('[data-ogrid-xlsx-media] img').length).toBe(0));
    rows = Array.from({ length: 8 }, (_, __rowIdx) => ({ __rowIdx }));
    sample.setAttribute('data-row-id', '3');
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());
    thA.remove();
    await waitFor(() => expect(document.querySelectorAll('[data-ogrid-xlsx-media] img').length).toBe(0));
    view.unmount();
    expect(root.querySelector('[data-ogrid-xlsx-media]')).toBeNull();
    root.remove();
  });

  test('shows an imported chart title and image in the grid and hides media anchored to hidden rows', async () => {
    const wb = await workbookFromBlob(await mediaWorkbookBlob());
    const original = HTMLElement.prototype.getBoundingClientRect;
    // Layout is a platform input: happy-dom otherwise reports zero-sized boxes.
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.tagName === 'TR' && this.hasAttribute('data-row-id')) return rect(0, 50 + Number(this.getAttribute('data-row-id')) * 28, 600, 28);
      if (this.tagName === 'TH') return rect(Array.from(this.parentElement?.children ?? []).indexOf(this) * 90, 0, 90, 50);
      if (this.tagName === 'THEAD') return rect(0, 0, 600, 50);
      return rect(0, 0, 600, 300);
    };
    try {
      const view = render(<XlsxWorkbookGrid workbook={wb} height={300} />);
      await waitFor(() => expect(screen.getByText('Chart: Sales by Region — opens in Excel')).toBeInTheDocument());
      expect(screen.getByRole('img', { name: 'Image at A2' })).toBeInTheDocument();
      view.unmount();
      wb.getWorksheet('Sales')!.getRow(2).hidden = true;
      render(<XlsxWorkbookGrid workbook={wb} height={300} />);
      await waitFor(() => expect(screen.getAllByText('West')).toHaveLength(2));
      await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
      expect(document.querySelectorAll('[data-ogrid-xlsx-media] img').length).toBe(0);
      expect(screen.queryByText('Chart: Sales by Region — opens in Excel')).not.toBeInTheDocument();
    } finally {
      HTMLElement.prototype.getBoundingClientRect = original;
    }
  });
});
