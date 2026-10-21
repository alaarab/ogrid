/**
 * Column reordering (`columnReorder`): drag a header to a new position with a
 * drop indicator, or move it from the keyboard through the header menu.
 * Runs in both kits.
 */

import { test, expect, type Page } from '@playwright/test';
import { waitForGrid } from './helpers';

/** Leaf header ids, left to right by on-screen position. */
async function headerOrder(page: Page): Promise<string[]> {
  return page.locator('thead th[data-column-id]').evaluateAll((ths) =>
    ths
      .map((th) => ({ id: th.getAttribute('data-column-id') ?? '', left: th.getBoundingClientRect().left }))
      .sort((a, b) => a.left - b.left)
      .map((c) => c.id),
  );
}

/** Body cell ids of the first row, left to right. */
async function bodyOrder(page: Page): Promise<string[]> {
  return page.locator('tbody tr').first().locator('td[data-column-id]').evaluateAll((tds) =>
    tds.map((td) => td.getAttribute('data-column-id') ?? ''),
  );
}

/** Press on a header's label area and drag horizontally to `toX` without releasing. */
async function startHeaderDrag(page: Page, columnId: string, toX: number): Promise<void> {
  const box = await page.locator(`thead th[data-column-id="${columnId}"]`).boundingBox();
  if (!box) throw new Error(`no header for ${columnId}`);
  // Left third of the cell: clear of the filter/menu buttons and the resize edge.
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 12, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 30, y, { steps: 3 });
  await page.mouse.move(toX, y, { steps: 8 });
}

test.describe('Column reorder', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?columnReorder');
    await waitForGrid(page);
  });

  test('dragging a header shows a drop indicator and moves the column, body included', async ({ page }) => {
    const before = await headerOrder(page);
    const [first, second, third] = before;
    if (!first || !second || !third) throw new Error('expected at least three columns');
    const thirdBox = await page.locator(`thead th[data-column-id="${third}"]`).boundingBox();
    if (!thirdBox) throw new Error('no third header');

    // Drop the first column just past the third column's midpoint.
    await startHeaderDrag(page, first, thirdBox.x + thirdBox.width * 0.75);
    const indicator = page.locator('[data-ogrid-column-drop-indicator]');
    await expect(indicator).toBeVisible();
    // The indicator sits on the third column's right edge (it follows the pointer frame by frame).
    await expect.poll(async () => Math.round((await indicator.boundingBox())?.x ?? 0)).toBeGreaterThan(thirdBox.x + thirdBox.width - 6);
    expect((await indicator.boundingBox())?.x ?? 0).toBeLessThan(thirdBox.x + thirdBox.width + 6);
    await page.mouse.up();

    await expect(indicator).toHaveCount(0);
    const expected = [second, third, first, ...before.slice(3)];
    await expect.poll(() => headerOrder(page)).toEqual(expected);
    expect(await bodyOrder(page)).toEqual(expected);
  });

  test('the drop indicator tracks the header edge after a horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    const region = page.locator('[data-column-id]').first().locator('xpath=ancestor::*[@role="region"][1]');
    await region.evaluate((el) => {
      el.scrollLeft = 300;
    });
    await expect.poll(() => region.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    // Pick two adjacent headers that are on screen and not covered (sticky columns, side bar):
    // the dragged one where it is pressed, the target across its whole width.
    const pair = await page.locator('thead th[data-column-id]').evaluateAll((ths) => {
      const hits = (th: Element, x: number, r: DOMRect) => th.contains(document.elementFromPoint(x, r.top + r.height / 2));
      const cols = ths
        .map((th) => ({ th, id: th.getAttribute('data-column-id') ?? '', r: th.getBoundingClientRect() }))
        .sort((a, b) => a.r.left - b.r.left);
      for (let i = 0; i + 1 < cols.length; i++) {
        const a = cols[i];
        const b = cols[i + 1];
        if (a && b && hits(a.th, a.r.left + 12, a.r) && hits(b.th, b.r.left + 2, b.r) && hits(b.th, b.r.right - 2, b.r)) return [a.id, b.id];
      }
      return [];
    });
    const [dragged, target] = pair;
    if (!dragged || !target) throw new Error('need two adjacent on-screen headers');
    const targetBox = await page.locator(`thead th[data-column-id="${target}"]`).boundingBox();
    if (!targetBox) throw new Error('no target header');
    await startHeaderDrag(page, dragged, targetBox.x + targetBox.width * 0.75);
    const indicator = page.locator('[data-ogrid-column-drop-indicator]');
    const edge = targetBox.x + targetBox.width;
    await expect.poll(async () => Math.abs(((await indicator.boundingBox())?.x ?? -999) - edge)).toBeLessThan(6);
    await page.mouse.up();
  });

  test('a short press does not reorder', async ({ page }) => {
    const before = await headerOrder(page);
    const box = await page.locator(`thead th[data-column-id="${before[0]}"]`).boundingBox();
    if (!box) throw new Error('no header');
    await page.mouse.move(box.x + 12, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 14, box.y + box.height / 2);
    await page.mouse.up();
    expect(await headerOrder(page)).toEqual(before);
  });

  test('keyboard: Move right / Move left from the column menu', async ({ page }) => {
    const before = await headerOrder(page);
    const [first, second] = before;
    if (!first || !second) throw new Error('expected at least two columns');
    const trigger = page.locator(`thead th[data-column-id="${first}"]`).getByRole('button', { name: /column options/i });

    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'Move left' })).toBeDisabled();
    await menu.getByRole('menuitem', { name: 'Move right' }).focus();
    await page.keyboard.press('Enter');
    await expect(menu).toHaveCount(0);
    await expect.poll(() => headerOrder(page)).toEqual([second, first, ...before.slice(2)]);
    // Focus goes back to the moved column's menu button, so the move can repeat.
    await expect(trigger).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await page.getByRole('menu').getByRole('menuitem', { name: 'Move left' }).focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => headerOrder(page)).toEqual(before);
  });
});

test.describe('Column reorder with pinned columns', () => {
  test('an unpinned column cannot be dragged into the left-pinned zone', async ({ page }) => {
    await page.goto('/?columnReorder&pinned');
    await waitForGrid(page);
    const before = await headerOrder(page);
    const [pinned, a, b] = before;
    if (!pinned || !a || !b) throw new Error('expected pinned + two columns');
    const pinnedBox = await page.locator(`thead th[data-column-id="${pinned}"]`).boundingBox();
    if (!pinnedBox) throw new Error('no pinned header');

    await startHeaderDrag(page, b, pinnedBox.x + 4);
    await page.mouse.up();
    // Lands at the start of the unpinned zone, right after the pinned column.
    await expect.poll(() => headerOrder(page)).toEqual([pinned, b, a, ...before.slice(3)]);
  });
});
