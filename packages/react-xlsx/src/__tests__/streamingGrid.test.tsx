import { expect, test } from 'bun:test';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { xlsxBlobFromWorkbook } from '../exportToXlsx';
import { dynamicArrayFixture } from './fixtures/dynamicArrayWorkbook';
import { xlsxWorkerFactory } from './fixtures/xlsxWorker';
import { diskRoundTrip } from './fixtures/xlsxFile';
import { workbookFromBlob } from '../sheetMapper';
import type { XlsxWorkbookDocument } from '../xlsxDocument';
import { XlsxWorkbookGrid } from '../XlsxWorkbookGrid';

test('Cancel stops the pending preview and clears its progress indicator', async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Values');
  ws.addRow(['Name', 'Amount']);
  for (let i = 0; i < 1000; i++) ws.addRow(['row-' + i, i]);
  render(<XlsxWorkbookGrid blob={new Blob([await wb.xlsx.writeBuffer()])} streaming streamOptions={{ chunkSize: 8 }} height={400} />);
  const cancel = await screen.findByRole('button', { name: 'Cancel' });
  fireEvent.click(cancel);
  expect(screen.getByText('Workbook loading cancelled.')).toBeInTheDocument();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
});

test('a streamed file switches to the editable model only after Enable editing', async () => {
  const wb = new ExcelJS.Workbook(); wb.addWorksheet('Values').addRows([['Name', 'Amount'], ['Alice', 12]]);
  const docs: import('../xlsxDocument').XlsxWorkbookDocument[] = [];
  render(<XlsxWorkbookGrid blob={new Blob([await wb.xlsx.writeBuffer()])} streaming editable height={400} onDocument={doc => { docs.push(doc); }} />);
  await screen.findByRole('button', { name: 'Enable editing' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Enable editing' }).hasAttribute('disabled')).toBe(false));
  expect(docs).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Enable editing' }));
  await waitFor(() => expect(docs).toHaveLength(1));
  expect(screen.getByText('Alice')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Enable editing' })).not.toBeInTheDocument();
});

test('replacing the file during editable preparation discards the old request', async () => {
  const file = async (name: string) => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Values').addRows([['Name', 'Amount'], [name, 12]]);
    return new Blob([await workbook.xlsx.writeBuffer()]);
  };
  const first = await file('Alice');
  const second = await file('Bob');
  const { rerender } = render(<XlsxWorkbookGrid blob={first} streaming editable height={400} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Enable editing' }).hasAttribute('disabled')).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Enable editing' }));
  rerender(<XlsxWorkbookGrid blob={second} streaming editable height={400} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Enable editing' }).hasAttribute('disabled')).toBe(false));
  expect(screen.queryByRole('alert')?.textContent).toBeUndefined();
  fireEvent.click(screen.getByRole('button', { name: 'Enable editing' }));
  await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument());
  expect(screen.queryByText('Alice')).not.toBeInTheDocument();
});


test('changing initialSheet after editing retains the same loaded document and edits', async () => {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Values').addRows([['Name', 'Amount'], ['Alice', 12]]);
  wb.addWorksheet('Other').addRows([['Name', 'Amount'], ['Bob', 24]]);
  const blob = new Blob([await wb.xlsx.writeBuffer()]);
  const docs: XlsxWorkbookDocument[] = [];
  const previews: unknown[] = [];
  const props = { blob, streaming: true, editable: true, height: 400,
    onDocument: (doc: XlsxWorkbookDocument) => { docs.push(doc); },
    onStreamedWorkbook: (preview: unknown) => { previews.push(preview); } };
  const { rerender } = render(<XlsxWorkbookGrid {...props} initialSheet="Values" />);
  await waitFor(() => expect(previews).toHaveLength(1));
  fireEvent.click(screen.getByRole('button', { name: 'Enable editing' }));
  await waitFor(() => expect(docs).toHaveLength(1));
  await screen.findByText('Alice');
  await waitFor(() => expect(screen.getByText('Alice').closest('[inert]')).toBeNull());
  const alice = screen.getByText('Alice');
  const cell = alice.closest('[data-row-index]') as HTMLElement;
  fireEvent.pointerDown(cell);
  fireEvent.doubleClick(cell);
  const input = await waitFor(() => {
    const editor = document.querySelector<HTMLInputElement>('tbody input');
    if (!editor) throw new Error('Cell editor did not open');
    return editor;
  });
  fireEvent.change(input, { target: { value: 'CHANGED' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await screen.findByText('CHANGED');
  rerender(<XlsxWorkbookGrid {...props} initialSheet="Other" />);
  await screen.findByText('Bob');
  rerender(<XlsxWorkbookGrid {...props} initialSheet="Values" />);
  await screen.findByText('CHANGED');
  expect(previews).toHaveLength(1);
  expect(docs).toHaveLength(1);
  expect((await workbookFromBlob(await docs[0]!.toBlob())).getWorksheet('Values')!.getCell('A2').value).toBe('CHANGED');
});

test('a read-only onDocument consumer still receives and exports a workbook above the default streaming threshold', async () => {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Values').addRows([['Name', 'Amount'], ['Alice', 12]]);
  const zip = await JSZip.loadAsync(await wb.xlsx.writeBuffer());
  zip.file('host-padding.bin', new Uint8Array(1024 ** 2));
  const blob = new Blob([await zip.generateAsync({ type: 'uint8array', compression: 'STORE' })]);
  expect(blob.size).toBeGreaterThan(1024 ** 2);
  const docs: XlsxWorkbookDocument[] = [];
  render(<XlsxWorkbookGrid blob={blob} height={400} onDocument={doc => { docs.push(doc); }} />);
  await waitFor(() => expect(docs).toHaveLength(1));
  await screen.findByText('Alice');
  expect(screen.queryByRole('button', { name: 'Enable editing' })).not.toBeInTheDocument();
  const reread = await workbookFromBlob(await docs[0]!.toBlob());
  expect(reread.getWorksheet('Values')!.getCell('B2').value).toBe(12);
});

test.each(['forced', 'automatic'])('valid CSV starting with PK works with %s streaming', async (mode) => {
  const blob = new Blob(['PK,Amount\nAlice,12\n', mode === 'automatic' ? `padding,${'0'.repeat(1024 ** 2)}\n` : '']);
  if (mode === 'automatic') expect(blob.size).toBeGreaterThan(1024 ** 2);
  render(<XlsxWorkbookGrid blob={blob} streaming={mode === 'forced' ? true : undefined} height={400} />);
  await screen.findByText('Alice');
  expect(screen.getByText('12')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});


test('Enable editing hands worker-loaded spills and frozen panes to structure and drag commands', async () => {
  const wb = await workbookFromBlob(await dynamicArrayFixture());
  const ws = wb.getWorksheet('Arrays')!;
  ws.getCell('C1').value = 'MOVE';
  ws.getCell('C2').value = 'destination';
  ws.getCell('C3').value = 'last';
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
  const blob = await diskRoundTrip(await xlsxBlobFromWorkbook(wb));
  let doc: XlsxWorkbookDocument | undefined;
  const workerFactory = await xlsxWorkerFactory();
  const { container } = render(<XlsxWorkbookGrid blob={blob} streaming editable headerRow="none" height={400}
    streamOptions={{ workerFactory }} onDocument={value => { doc = value; }} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Enable editing' }).hasAttribute('disabled')).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Enable editing' }));
  await waitFor(() => expect(doc).toBeDefined());
  await waitFor(() => expect(container.querySelector('[inert]')).toBeNull());
  const cell = (row: number, col: number) => container.querySelector<HTMLElement>(`tbody tr[data-row-id="${row}"] td[data-column-id="${String.fromCharCode(65 + col)}"] [data-row-index]`)!;
  await waitFor(() => expect(cell(1, 1)?.textContent).toBe('2'));
  expect(cell(0, 0).closest('td')!.style.left).not.toBe('');
  expect(doc!.sheet('Arrays')!.rows[1]!.B).toBe('');
  const command = async (target: HTMLElement, label: string) => {
    fireEvent.pointerDown(target);
    fireEvent.contextMenu(target);
    fireEvent.click(await screen.findByText(label));
  };
  await command(cell(1, 2), 'Unfreeze panes');
  expect(doc!.sheet('Arrays')!.frozen).toEqual({ rows: 0, columns: 0 });
  await command(cell(0, 2), 'Insert row above');
  await waitFor(() => expect(cell(2, 1)?.textContent).toBe('2'));
  fireEvent.pointerDown(cell(1, 2));
  const handle = await waitFor(() => {
    const element = container.querySelector<HTMLElement>('[data-ogrid-range-move-handle]');
    if (!element) throw new Error('Range move handle did not appear');
    return element;
  });
  const transfer = new DataTransfer();
  fireEvent.dragStart(handle, { dataTransfer: transfer });
  expect(fireEvent.dragOver(cell(2, 2), { dataTransfer: transfer })).toBe(false);
  fireEvent.drop(cell(2, 2), { dataTransfer: transfer });
  await waitFor(() => expect(doc!.sheet('Arrays')!.rows[2]!.C).toBe('MOVE'));
  expect(doc!.sheet('Arrays')!.rows[1]!.C).toBe('');
  const output = await diskRoundTrip(await doc!.toBlob());
  const reread = await workbookFromBlob(output);
  expect(reread.getWorksheet('Arrays')!.getCell('C3').value).toBe('MOVE');
  expect(reread.getWorksheet('Arrays')!.getCell('B4').value).toBe(3);
  expect(reread.getWorksheet('Arrays')!.views.every(view => view.state !== 'frozen')).toBe(true);
  const zip = await JSZip.loadAsync(await output.arrayBuffer());
  expect(zip.file('xl/metadata.xml')).not.toBeNull();
  await act(async () => { doc!.undo('Arrays'); });
  await waitFor(() => expect(doc!.sheet('Arrays')!.rows[1]!.C).toBe('MOVE'));
}, 20000);
