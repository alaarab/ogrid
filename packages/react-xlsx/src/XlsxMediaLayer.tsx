import { useEffect, useMemo, useState, type RefObject } from 'react';
import type ExcelJS from 'exceljs';
import type { IOGridApi } from '@alaarab/ogrid-core';
import { indexToColumnLetter } from '@alaarab/ogrid-core';
import { sourceArchiveOf, type ChartAnchor } from './sourceArchive';
import type { SheetRow } from './sheetMapper';

interface Media extends ChartAnchor { id: string; src?: string }
interface Box { id: string; left: number; top: number; width: number; height: number }
interface Layout { left: number; top: number; width: number; height: number; boxes: Box[] }

/** An XLSX-only overlay; the base grid and both UI kits carry no media code. */
export function XlsxMediaLayer({ workbook, sheetName, rootRef, apiRef, headerPromoted, rowHeight, rowHeights }: {
  workbook: ExcelJS.Workbook;
  sheetName: string;
  rootRef: RefObject<HTMLDivElement | null>;
  apiRef: RefObject<IOGridApi<SheetRow> | null>;
  headerPromoted: boolean;
  rowHeight: number;
  rowHeights: Record<string, number>;
}) {
  const media = useMemo(() => {
    const ws = workbook.getWorksheet(sheetName);
    const out: Media[] = [];
    for (const image of ws?.getImages() ?? []) {
      const data = workbook.getImage(Number(image.imageId));
      if (!data) continue;
      const range = image.range as ExcelJS.ImageRange & { ext?: { width: number; height: number } };
      let src = data.base64;
      if (src && !src.startsWith('data:')) src = `data:image/${data.extension};base64,${src}`;
      if (!src && data.buffer) {
        let binary = '';
        for (const byte of new Uint8Array(data.buffer)) binary += String.fromCharCode(byte);
        src = `data:image/${data.extension};base64,${btoa(binary)}`;
      }
      if (!src) continue;
      out.push({ id: `image-${out.length}`, title: `Image at ${indexToColumnLetter(Math.floor(range.tl.col))}${Math.floor(range.tl.row) + 1}`, src,
        tl: { col: range.tl.col, row: range.tl.row },
        ...(range.br ? { br: { col: range.br.col, row: range.br.row } } : {}), ext: range.ext });
    }
    for (const chart of sourceArchiveOf(workbook)?.charts.get(sheetName) ?? []) out.push({ ...chart, id: `chart-${out.length}` });
    return out;
  }, [workbook, sheetName]);
  const [layout, setLayout] = useState<Layout | null>(null);
  useEffect(() => {
    const root = rootRef.current;
    const container = root?.querySelector<HTMLElement>('[data-ogrid-scroll-container]');
    if (!root || !container || !media.length) { setLayout(null); return; }
    let frame = 0;
    let previousRows: SheetRow[] | undefined;
    let rowIndex = new Map<number, number>();
    let offsets: number[] = [];
    const offset = headerPromoted ? 1 : 0;
    const update = () => {
      const rows = apiRef.current?.getDisplayedRows() ?? [];
      if (rows !== previousRows) {
        previousRows = rows;
        rowIndex = new Map(rows.map((r, i) => [r.__rowIdx, i]));
        offsets = [0];
        for (const row of rows) offsets.push((offsets[offsets.length - 1] ?? 0) + (rowHeights[String(row.__rowIdx)] ?? rowHeight));
      }
      const rootRect = root.getBoundingClientRect();
      const rect = container.getBoundingClientRect();
      const header = container.querySelector('thead')?.getBoundingClientRect();
      const clipTop = Math.max(rect.top, header?.bottom ?? rect.top);
      const sample = container.querySelector<HTMLElement>('tbody tr[data-row-id]:not([data-frozen-row])') ?? container.querySelector<HTMLElement>('tbody tr[data-row-id]');
      const sampleId = Number(sample?.getAttribute('data-row-id'));
      const sampleIndex = rowIndex.get(sampleId);
      if (!sample || sampleIndex === undefined) { setLayout(null); return; }
      const sampleTop = sample.getBoundingClientRect().top;
      const columnRects = new Map(Array.from(container.querySelectorAll<HTMLElement>('thead th[data-column-id]'), (th) => [th.getAttribute('data-column-id') ?? '', th.getBoundingClientRect()]));
      const rowPosition = (row: number) => {
        const id = Math.floor(row) - offset;
        const frozen = container.querySelector<HTMLElement>(`tbody tr[data-row-id="${id}"][data-frozen-row]`);
        if (frozen) return frozen.getBoundingClientRect().top + (row % 1) * (rowHeights[String(id)] ?? rowHeight);
        // The bottom/right marker may be the boundary just after the last cell.
        const i = rowIndex.get(id);
        if (i !== undefined) return sampleTop + (offsets[i] ?? 0) - (offsets[sampleIndex] ?? 0) + (row % 1) * (rowHeights[String(id)] ?? rowHeight);
        if (row % 1 === 0) {
          const prev = rowIndex.get(id - 1);
          if (prev !== undefined) return sampleTop + (offsets[prev + 1] ?? 0) - (offsets[sampleIndex] ?? 0);
        }
        return undefined;
      };
      const colPosition = (col: number) => {
        const r = columnRects.get(indexToColumnLetter(Math.floor(col)));
        if (r) return r.left + (col % 1) * r.width;
        return col % 1 === 0 ? columnRects.get(indexToColumnLetter(Math.floor(col) - 1))?.right : undefined;
      };
      const boxes: Box[] = [];
      for (const item of media) {
        // Hidden, filtered, truncated or off-page anchors have no displayed row/column.
        if (!rowIndex.has(Math.floor(item.tl.row) - offset) || !columnRects.has(indexToColumnLetter(Math.floor(item.tl.col)))) continue;
        const left = colPosition(item.tl.col);
        const top = rowPosition(item.tl.row);
        const right = item.br ? colPosition(item.br.col) : left !== undefined ? left + (item.ext?.width ?? 240) : undefined;
        const bottom = item.br ? rowPosition(item.br.row) : top !== undefined ? top + (item.ext?.height ?? 120) : undefined;
        if (left === undefined || top === undefined || right === undefined || bottom === undefined) continue;
        if (right < rect.left || left > rect.right || bottom < clipTop || top > rect.bottom) continue;
        boxes.push({ id: item.id, left: left - rect.left, top: top - clipTop, width: Math.max(0, right - left), height: Math.max(0, bottom - top) });
      }
      const next = { left: rect.left - rootRect.left, top: clipTop - rootRect.top, width: container.clientWidth || rect.width, height: Math.max(0, (container.clientHeight || rect.height) - (clipTop - rect.top)), boxes };
      setLayout((prev) => JSON.stringify(prev) === JSON.stringify(next) ? prev : next);
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; update(); });
    };
    // Observe the table only, so painting the overlay cannot retrigger itself.
    const observer = new MutationObserver(schedule);
    const table = container.querySelector('table');
    if (table) observer.observe(table, { childList: true, subtree: true, attributes: true });
    const resize = new ResizeObserver(schedule);
    resize.observe(container);
    if (table) resize.observe(table);
    container.addEventListener('scroll', schedule, { passive: true });
    update();
    return () => { observer.disconnect(); resize.disconnect(); container.removeEventListener('scroll', schedule); cancelAnimationFrame(frame); };
  }, [media, rootRef, apiRef, headerPromoted, rowHeight, rowHeights]);
  if (!layout) return null;
  return (
    <div data-ogrid-xlsx-media="" style={{ position: 'absolute', pointerEvents: 'none', overflow: 'hidden', zIndex: 2, left: layout.left, top: layout.top, width: layout.width, height: layout.height }}>
      {layout.boxes.map((box) => {
        const item = media.find((m) => m.id === box.id);
        if (!item) return null;
        const style = { position: 'absolute' as const, left: box.left, top: box.top, width: box.width, height: box.height };
        return item.src ? <img key={item.id} src={item.src} alt={item.title} draggable={false} style={style} /> : (
          <div key={item.id} style={{ ...style, boxSizing: 'border-box', padding: 8, border: '1px dashed #888', background: 'var(--ogrid-bg, #fff)', color: 'var(--ogrid-fg, #333)', fontSize: 12, overflow: 'hidden' }}>
            Chart: {item.title} — opens in Excel
          </div>
        );
      })}
    </div>
  );
}
