/**
 * Large-grid benchmark: 2,000 rows x 20 columns with custom React renderers,
 * editing and range selection (packages/examples/src/radix/perf-large-grid.tsx).
 *
 * Run:  npm run build:react-family && npm run bench:large-grid
 *
 * Compare a published release: install it somewhere, build the page against it
 * and serve the output, then point the bench at it:
 *   (cd /tmp/v2.18.0 && npm i @alaarab/ogrid-react-radix@2.18.0)
 *   OGRID_PERF_RADIX=/tmp/v2.18.0/node_modules/@alaarab/ogrid-react-radix OGRID_PERF_OUT=/tmp/perf/v2.18.0 \
 *     bun --filter @alaarab/ogrid-examples build:perf
 *   python3 -m http.server 4100 --directory /tmp/perf &
 *   OGRID_PERF_URL=http://127.0.0.1:4100/v2.18.0/perf-large-grid.html OGRID_PERF_LABEL=v2.18.0 \
 *     OGRID_PERF_BUDGETS=0 npm run bench:large-grid
 * OGRID_PERF_VARIANTS=virtual (or all) runs one variant: `all` renders every
 * row (pageSize 'all'), `virtual` turns on row virtualization.
 *
 * Each scenario prints one JSON line `PERF {...}` and the whole run is written
 * to perf-results/large-grid-<label>.json. Timings are wall clock in a
 * production build; `renders` counts custom renderCell calls (one per custom
 * cell a row re-render repaints), which is deterministic.
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.OGRID_PERF_URL ?? 'http://localhost:3009/perf-large-grid.html';
const LABEL = process.env.OGRID_PERF_LABEL ?? 'local';
const VARIANTS = (process.env.OGRID_PERF_VARIANTS ?? 'all,virtual').split(',');

interface PerfWindow {
  __perf: {
    cellRenders: number;
    appRenders: number;
    initialRenderMs: number;
    longTasks: { start: number; duration: number }[];
    events: { name: string; duration: number; processing: number; start: number }[];
    api: {
      applyColumnState: (s: unknown) => void;
      setFilterModel: (f: unknown) => void;
      clearFilters: () => void;
    } | null;
    bumpParent: () => void;
    reset: () => void;
  };
}

const results: Record<string, unknown>[] = [];

/**
 * Render budgets: custom renderCell calls per scenario (ten custom columns, so
 * 10 = one row). Deterministic, so they hold on a loaded machine and fail when
 * a change starts repainting rows an interaction didn't touch. Set
 * OGRID_PERF_BUDGETS=0 to only record (e.g. when measuring older releases).
 */
const RENDER_BUDGETS: Record<string, number> = {
  cellClick: 20,
  arrowKey: 200, // 10 presses, two rows each
  selectionDrag: 120,
  copy: 100,
  paste: 200,
  undo: 100,
  redo: 100,
  fillDrag: 100,
  editCommit: 20,
  rangeDelete: 100,
  headerMenus: 0,
  parentRerenderStable: 0,
};
const ENFORCE_BUDGETS = process.env.OGRID_PERF_BUDGETS !== '0';

function record(variant: string, scenario: string, data: Record<string, unknown>) {
  const row = { label: LABEL, variant, scenario, ...data };
  results.push(row);
  console.log(`PERF ${JSON.stringify(row)}`);
  const budget = RENDER_BUDGETS[scenario];
  if (ENFORCE_BUDGETS && budget !== undefined && typeof data.renders === 'number') {
    expect.soft(data.renders, `${variant}/${scenario} renderCell calls`).toBeLessThanOrEqual(budget);
  }
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s[Math.floor(s.length / 2)] as number) : 0;
};
const round = (n: number) => Math.round(n * 10) / 10;

/** Resolves after the next frame has been produced (rAF + a task). */
async function nextPaint(page: Page) {
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0))));
}

async function reset(page: Page) {
  await page.evaluate(() => (window as unknown as PerfWindow).__perf.reset());
}

async function counters(page: Page) {
  return page.evaluate(() => {
    const p = (window as unknown as PerfWindow).__perf;
    const long = p.longTasks;
    return {
      renders: p.cellRenders,
      longTasks: long.length,
      longTaskMs: Math.round(long.reduce((a, t) => a + t.duration, 0)),
      maxLongTaskMs: Math.round(long.reduce((a, t) => Math.max(a, t.duration), 0)),
    };
  });
}

function cell(page: Page, rowId: string, columnId: string) {
  return page.locator(`tbody tr[data-row-id="${rowId}"] td[data-column-id="${columnId}"]`).first();
}

async function center(page: Page, rowId: string, columnId: string) {
  const box = await cell(page, rowId, columnId).boundingBox();
  if (!box) throw new Error(`no cell ${rowId}/${columnId}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Time one interaction until the frame after it. */
async function timed(page: Page, action: () => Promise<void>) {
  const t0 = Date.now();
  await action();
  await nextPaint(page);
  return Date.now() - t0;
}

for (const variant of VARIANTS) {
  test.describe(`large grid (${variant})`, () => {
    test.describe.configure({ mode: 'serial' });
    const url = `${BASE}?rows=2000${variant === 'virtual' ? '&virtual=1' : ''}`;

    test('initial render', async ({ page }) => {
      const samples: number[] = [];
      let tds = 0;
      for (let i = 0; i < 3; i++) {
        await page.goto(url);
        await page.waitForFunction(() => (window as unknown as PerfWindow).__perf.initialRenderMs >= 0, null, { timeout: 60_000 });
        samples.push(await page.evaluate(() => (window as unknown as PerfWindow).__perf.initialRenderMs));
        tds = await page.locator('tbody td').count();
      }
      const c = await counters(page);
      record(variant, 'initialRender', { ms: round(median(samples)), samples: samples.map(round), tds, longTaskMs: c.longTaskMs, maxLongTaskMs: c.maxLongTaskMs });
    });

    test('interactions', async ({ page, context }) => {
      test.setTimeout(240_000);
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.goto(url);
      await page.waitForFunction(() => (window as unknown as PerfWindow).__perf.initialRenderMs >= 0, null, { timeout: 60_000 });
      await nextPaint(page);

      // --- Scroll: 2 s of 60px-per-frame scrolling in the grid's scroll container.
      await reset(page);
      const scroll = await page.evaluate(async () => {
        const table = document.querySelector('table');
        let el: HTMLElement | null = table?.parentElement ?? null;
        while (el && !(el.scrollHeight > el.clientHeight + 10 && /(auto|scroll)/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
        const scroller = el ?? document.scrollingElement as HTMLElement;
        const frames: number[] = [];
        const start = performance.now();
        await new Promise<void>((resolve) => {
          let last = start;
          const step = (now: number) => {
            frames.push(now - last);
            last = now;
            scroller.scrollTop += 60;
            if (now - start < 2000) requestAnimationFrame(step);
            else resolve();
          };
          requestAnimationFrame(step);
        });
        const elapsed = performance.now() - start;
        scroller.scrollTop = 0;
        const sorted = [...frames].sort((a, b) => a - b);
        return {
          fps: Math.round((frames.length / elapsed) * 1000 * 10) / 10,
          p95FrameMs: Math.round((sorted[Math.floor(sorted.length * 0.95)] ?? 0) * 10) / 10,
          maxFrameMs: Math.round((sorted[sorted.length - 1] ?? 0) * 10) / 10,
          scrollerTag: scroller.tagName,
        };
      });
      await nextPaint(page);
      record(variant, 'scroll', { ...scroll, ...(await counters(page)) });

      // --- Single click (select a cell).
      await reset(page);
      const a = await center(page, 'r3', 'reason');
      const clickMs = await timed(page, () => page.mouse.click(a.x, a.y));
      record(variant, 'cellClick', { ms: clickMs, ...(await counters(page)) });

      // --- Keyboard navigation: ArrowDown x10.
      await reset(page);
      const keyMs: number[] = [];
      for (let i = 0; i < 10; i++) keyMs.push(await timed(page, () => page.keyboard.press('ArrowDown')));
      const keyC = await counters(page);
      record(variant, 'arrowKey', { medianMs: median(keyMs), rendersPerKey: keyC.renders / 10, ...keyC });

      // --- Range selection drag: r3/reason -> r12/notes in 20 moves.
      await page.mouse.click(a.x, a.y);
      await nextPaint(page);
      await reset(page);
      const b = await center(page, 'r12', 'notes');
      const moveMs: number[] = [];
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      for (let i = 1; i <= 20; i++) {
        const x = a.x + ((b.x - a.x) * i) / 20;
        const y = a.y + ((b.y - a.y) * i) / 20;
        moveMs.push(await timed(page, () => page.mouse.move(x, y)));
      }
      await page.mouse.up();
      await nextPaint(page);
      const dragC = await counters(page);
      record(variant, 'selectionDrag', { medianMoveMs: median(moveMs), maxMoveMs: Math.max(...moveMs), rendersPerMove: round(dragC.renders / 20), ...dragC });

      // --- Copy the range, paste it elsewhere, undo, redo.
      await reset(page);
      const copyMs = await timed(page, () => page.keyboard.press('ControlOrMeta+c'));
      const copyC = await counters(page);
      record(variant, 'copy', { ms: copyMs, ...copyC });
      const p = await center(page, 'r14', 'reason');
      await page.mouse.click(p.x, p.y);
      await nextPaint(page);
      await reset(page);
      const pasteMs = await timed(page, () => page.keyboard.press('ControlOrMeta+v'));
      record(variant, 'paste', { ms: pasteMs, ...(await counters(page)) });
      await reset(page);
      const undoMs = await timed(page, () => page.keyboard.press('ControlOrMeta+z'));
      record(variant, 'undo', { ms: undoMs, ...(await counters(page)) });
      await reset(page);
      const redoMs = await timed(page, () => page.keyboard.press('ControlOrMeta+y'));
      record(variant, 'redo', { ms: redoMs, ...(await counters(page)) });

      // --- Fill handle drag down 7 rows from a single cell.
      const f = await center(page, 'r5', 'halo');
      await page.mouse.click(f.x, f.y);
      await nextPaint(page);
      const handle = page.locator('[aria-label="Fill handle"]').first();
      const hb = await handle.waitFor({ timeout: 3000 }).then(() => handle.boundingBox(), () => null);
      if (!hb) record(variant, 'fillDrag', { skipped: 'no fill handle' });
      if (hb) {
        await reset(page);
        const target = await center(page, 'r12', 'halo');
        const fillMoves: number[] = [];
        await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
        await page.mouse.down();
        for (let i = 1; i <= 10; i++) {
          fillMoves.push(await timed(page, () => page.mouse.move(target.x, hb.y + ((target.y - hb.y) * i) / 10)));
        }
        const upMs = await timed(page, () => page.mouse.up());
        record(variant, 'fillDrag', { medianMoveMs: median(fillMoves), commitMs: upMs, ...(await counters(page)) });
      }

      // --- Single-cell edit commit (type into a text cell, Enter).
      const e = await center(page, 'r8', 'notes');
      await page.mouse.dblclick(e.x, e.y);
      await page.waitForSelector('[data-ogrid-cell-editor] input, [data-ogrid-cell-editor] textarea', { timeout: 5000 });
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.type('edited');
      await nextPaint(page);
      await reset(page);
      const commitMs = await timed(page, () => page.keyboard.press('Enter'));
      record(variant, 'editCommit', { ms: commitMs, ...(await counters(page)) });

      // --- Multi-cell clear (Delete on a 10x5 range).
      const d0 = await center(page, 'r2', 'reason');
      const d1 = await center(page, 'r11', 'notes');
      await page.mouse.click(d0.x, d0.y);
      await page.keyboard.down('Shift');
      await page.mouse.click(d1.x, d1.y);
      await page.keyboard.up('Shift');
      await nextPaint(page);
      await reset(page);
      const delMs = await timed(page, () => page.keyboard.press('Delete'));
      record(variant, 'rangeDelete', { ms: delMs, ...(await counters(page)) });

      // --- Sort and filter through the API.
      await reset(page);
      const sortFilter = await page.evaluate(async () => {
        const p = (window as unknown as PerfWindow).__perf;
        const paint = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));
        const time = async (fn: () => void) => {
          const t0 = performance.now();
          fn();
          await paint();
          return Math.round(performance.now() - t0);
        };
        return {
          sortMs: await time(() => p.api?.applyColumnState({ sort: { field: 'views', direction: 'desc' } })),
          sortBackMs: await time(() => p.api?.applyColumnState({ sort: { field: 'name', direction: 'asc' } })),
          filterTextMs: await time(() => p.api?.setFilterModel({ name: { type: 'text', value: 'Revenue' } })),
          filterMultiMs: await time(() => p.api?.setFilterModel({ name: { type: 'text', value: 'Revenue' }, ppStatus: { type: 'multiSelect', value: ['Active'] } })),
          clearMs: await time(() => p.api?.clearFilters()),
        };
      });
      record(variant, 'sortFilter', { ...sortFilter, ...(await counters(page)) });

      // --- Column menu and filter popover open/close (must not repaint rows).
      await reset(page);
      const menuOpenMs = await timed(page, () => page.getByRole('button', { name: 'Notes column options' }).click());
      const menuCloseMs = await timed(page, () => page.keyboard.press('Escape'));
      const filterOpenMs = await timed(page, () => page.getByRole('button', { name: 'Filter PP status' }).click());
      const filterCloseMs = await timed(page, () => page.keyboard.press('Escape'));
      record(variant, 'headerMenus', { menuOpenMs, menuCloseMs, filterOpenMs, filterCloseMs, ...(await counters(page)) });

      // --- Column resize drag (10 moves).
      await reset(page);
      const handleBox = await page.getByRole('separator', { name: 'Resize column Notes' }).or(page.locator('[aria-label="Resize column Notes"]')).first().boundingBox();
      if (handleBox) {
        const hx = handleBox.x + handleBox.width / 2;
        const hy = handleBox.y + handleBox.height / 2;
        const resizeMoves: number[] = [];
        await page.mouse.move(hx, hy);
        await page.mouse.down();
        for (let i = 1; i <= 10; i++) resizeMoves.push(await timed(page, () => page.mouse.move(hx + i * 8, hy)));
        await page.mouse.up();
        await nextPaint(page);
        record(variant, 'columnResize', { medianMoveMs: median(resizeMoves), ...(await counters(page)) });
      }

      // --- Parent re-render with stable props.
      await reset(page);
      const bumpMs: number[] = [];
      for (let i = 0; i < 10; i++) bumpMs.push(await timed(page, () => page.evaluate(() => (window as unknown as PerfWindow).__perf.bumpParent())));
      const bumpC = await counters(page);
      record(variant, 'parentRerenderStable', { medianMs: median(bumpMs), rendersPerBump: bumpC.renders / 10, ...bumpC });
    });

    test('parent re-render with unstable columns', async ({ page }) => {
      await page.goto(`${url}&cols=unstable`);
      await page.waitForFunction(() => (window as unknown as PerfWindow).__perf.initialRenderMs >= 0, null, { timeout: 60_000 });
      await nextPaint(page);
      await reset(page);
      const bumpMs: number[] = [];
      for (let i = 0; i < 10; i++) bumpMs.push(await timed(page, () => page.evaluate(() => (window as unknown as PerfWindow).__perf.bumpParent())));
      const c = await counters(page);
      record(variant, 'parentRerenderUnstable', { medianMs: median(bumpMs), rendersPerBump: c.renders / 10, ...c });
    });
  });
}

// Outside test-results/, which Playwright empties at the start of every run.
test.afterAll(() => {
  mkdirSync('perf-results', { recursive: true });
  writeFileSync(`perf-results/large-grid-${LABEL}.json`, `${JSON.stringify(results, null, 2)}\n`);
});
