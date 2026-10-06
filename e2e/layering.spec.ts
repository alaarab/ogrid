/**
 * Fullscreen layering and pinned-column geometry, checked in a real browser for
 * both kits. jsdom can't answer either question: it does no stacking or layout.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  getCellContent,
  getContextMenu,
  getFilterPopover,
  openColumnChooser,
  openColumnOptions,
  openFilter,
  rightClickCell,
  waitForGrid,
} from './helpers';

/** True when the topmost element at the surface's center belongs to the surface. */
async function isOnTop(surface: Locator): Promise<boolean> {
  return surface.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 20));
    return !!hit && el.contains(hit);
  });
}

async function enterFullscreen(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Exit fullscreen' })).toBeVisible();
}

test.describe('Fullscreen layering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
    await enterFullscreen(page);
  });

  test('filter popover renders above the fullscreen grid', async ({ page }) => {
    await openFilter(page, 'Project Name');
    expect(await isOnTop(getFilterPopover(page))).toBe(true);
  });

  test('column chooser renders above the fullscreen grid', async ({ page }) => {
    await openColumnChooser(page);
    expect(await isOnTop(page.getByRole('button', { name: /select all/i }).first())).toBe(true);
  });

  test('column options menu renders above the fullscreen grid', async ({ page }) => {
    await openColumnOptions(page, 'Project Name');
    expect(await isOnTop(page.getByRole('menu').first())).toBe(true);
  });

  test('context menu renders above the fullscreen grid', async ({ page }) => {
    await rightClickCell(page, 0, 0);
    expect(await isOnTop(getContextMenu(page))).toBe(true);
  });

  test('rich select dropdown renders above the fullscreen grid', async ({ page }) => {
    const status = getCellContent(page, 0, 1);
    await status.click();
    await status.dblclick();
    const listbox = page.getByRole('listbox').first();
    await expect(listbox).toBeVisible();
    expect(await isOnTop(listbox)).toBe(true);
  });
});

/** The grid's horizontal scroller: the table's nearest ancestor that scrolls on x. */
function scrollGridTo(page: Page, scrollLeft: number) {
  return page.evaluate((left) => {
    let el = document.querySelector('table')?.parentElement ?? null;
    while (el && !(el.scrollWidth > el.clientWidth && ['auto', 'scroll'].includes(getComputedStyle(el).overflowX))) {
      el = el.parentElement;
    }
    if (!el) throw new Error('no horizontal scroller');
    el.scrollLeft = left;
    return el.scrollLeft;
  }, scrollLeft);
}

test.describe('Pinned columns', () => {
  test('leading and left-pinned columns stay put, and stay opaque, while the grid scrolls sideways', async ({ page }) => {
    // Checkbox column, row numbers and the column-letter row, plus a left-pinned column.
    await page.goto('/?rowSelection&cellReferences');
    await waitForGrid(page);
    await openColumnOptions(page, 'Project Name');
    await page.getByRole('menuitem', { name: 'Pin left' }).click();
    await page.mouse.move(0, 0);

    const stripClip = () => page.evaluate(() => {
      const table = document.querySelector('table');
      const pinned = document.querySelector('tbody tr td[data-column-id="name"]');
      if (!table || !pinned) throw new Error('grid not rendered');
      const t = table.getBoundingClientRect();
      const top = Math.max(t.top, 0);
      return { x: t.left, y: top, width: pinned.getBoundingClientRect().right - t.left, height: Math.min(t.bottom, top + 320) - top };
    });
    const geometry = () => page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('tbody tr:first-child td'));
      const pinned = document.querySelector('tbody tr:first-child td[data-column-id="name"]');
      const header = document.querySelector('thead th[data-column-id="name"]');
      const lastLeading = pinned ? cells[cells.indexOf(pinned) - 1] : undefined;
      if (!pinned || !header || !lastLeading) throw new Error('expected leading, pinned and header cells');
      return {
        leadRight: lastLeading.getBoundingClientRect().right,
        pinnedLeft: pinned.getBoundingClientRect().left,
        headerLeft: header.getBoundingClientRect().left,
      };
    });

    const before = await geometry();
    // The pinned column starts where the checkbox + row-number columns end.
    expect(Math.abs(before.pinnedLeft - before.leadRight)).toBeLessThanOrEqual(1);
    expect(Math.abs(before.headerLeft - before.pinnedLeft)).toBeLessThanOrEqual(1);
    const clip = await stripClip();
    const pixelsBefore = await page.screenshot({ clip });

    expect(await scrollGridTo(page, 400)).toBeGreaterThan(0);
    await page.waitForTimeout(100);
    const after = await geometry();
    expect(after).toEqual(before);
    // Nothing from the scrolled columns may show in or between the sticky
    // columns: not a column letter over the checkbox/row-number spacers, not a
    // sliver of text through a border seam. The strip must look the same.
    expect(await page.screenshot({ clip })).toEqual(pixelsBefore);
  });
});
