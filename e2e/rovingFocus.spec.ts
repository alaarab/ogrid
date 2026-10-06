/**
 * Roving focus (WAI-ARIA grid pattern): the active cell's gridcell <td> holds
 * real DOM focus, so `document.activeElement` follows keyboard and pointer
 * navigation. Runs in both kits.
 */

import { test, expect, type Page } from '@playwright/test';
import { waitForGrid, getDataCell, getGridRegion, expectSelectedRowCount } from './helpers';

/** Where focus is: the focused cell's coordinates, the grid wrapper, or another element's tag. */
async function focusedCell(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return 'none';
    if (el.getAttribute('role') === 'region') return 'wrapper';
    const content = el.tagName === 'TD' ? el.querySelector(':scope > [data-row-index][data-col-index]') : null;
    if (content) return `r${content.getAttribute('data-row-index')}c${content.getAttribute('data-col-index')}`;
    return el.tagName.toLowerCase();
  });
}

/** data-col-index of a column's cells (row-number/checkbox columns shift it). */
async function colIndexOf(page: Page, columnId: string): Promise<number> {
  const value = await getDataCell(page, 0, columnId).locator(':scope > [data-col-index]').getAttribute('data-col-index');
  return Number(value);
}

async function tabStopCount(page: Page): Promise<number> {
  return page.locator('tbody td[tabindex="0"]').count();
}

test.describe('Roving focus', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('Tab reaches the grid on its first data cell, which becomes active', async ({ page }) => {
    expect(await tabStopCount(page)).toBe(1);
    const firstCol = await colIndexOf(page, 'name');
    // Tab through the page chrome and header controls until a body cell takes focus.
    let where = '';
    for (let i = 0; i < 150 && !where.startsWith('r'); i += 1) {
      await page.keyboard.press('Tab');
      where = await focusedCell(page);
    }
    expect(where).toBe(`r0c${firstCol}`);
    await expect(getDataCell(page, 0, 'name').locator(':scope > div').first()).toHaveAttribute('data-active-cell', 'true');
  });

  test('DOM focus follows arrow keys, Ctrl+arrows, Home/End and Tab', async ({ page }) => {
    const nameCol = await colIndexOf(page, 'name');
    await getDataCell(page, 0, 'name').click();
    expect(await focusedCell(page)).toBe(`r0c${nameCol}`);

    await page.keyboard.press('ArrowDown');
    expect(await focusedCell(page)).toBe(`r1c${nameCol}`);
    await page.keyboard.press('ArrowRight');
    expect(await focusedCell(page)).toBe(`r1c${nameCol + 1}`);
    await page.keyboard.press('Tab');
    expect(await focusedCell(page)).toBe(`r1c${nameCol + 2}`);
    await page.keyboard.press('Home');
    expect(await focusedCell(page)).toBe(`r1c${nameCol}`);
    await page.keyboard.press('Control+ArrowDown');
    const last = await focusedCell(page);
    expect(last).toMatch(new RegExp(`^r\\d+c${nameCol}$`));
    expect(last).not.toBe(`r1c${nameCol}`);
    await page.keyboard.press('Control+Home');
    expect(await focusedCell(page)).toBe(`r0c${nameCol}`);
    // Shift+Arrow extends the range; the anchor keeps focus.
    await page.keyboard.press('Shift+ArrowDown');
    expect(await focusedCell(page)).toBe(`r0c${nameCol}`);
    expect(await tabStopCount(page)).toBe(1);
  });

  test('clicking a cell focuses it, and focus returns to it after an edit', async ({ page }) => {
    const nameCol = await colIndexOf(page, 'name');
    await getDataCell(page, 2, 'name').click();
    expect(await focusedCell(page)).toBe(`r2c${nameCol}`);

    await page.keyboard.press('F2');
    expect(await focusedCell(page)).toBe('input');
    await page.keyboard.press('Escape');
    expect(await focusedCell(page)).toBe(`r2c${nameCol}`);

    await page.keyboard.press('Enter');
    expect(await focusedCell(page)).toBe('input');
    await page.keyboard.press('Enter');
    // Enter commits and moves down, like Excel; focus follows.
    expect(await focusedCell(page)).toBe(`r3c${nameCol}`);
  });

  test('Escape clears the active cell but keeps focus on the cell', async ({ page }) => {
    const nameCol = await colIndexOf(page, 'name');
    await getDataCell(page, 1, 'name').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-active-cell="true"]')).toHaveCount(0);
    expect(await focusedCell(page)).toBe(`r1c${nameCol}`);
    expect(await tabStopCount(page)).toBe(1);
  });
});

test.describe('Roving focus with a row checkbox column', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?rowSelection=1');
    await waitForGrid(page);
  });

  test('row checkboxes are not tab stops; Shift+Tab from the first cell leaves the grid body', async ({ page }) => {
    const firstCol = await colIndexOf(page, 'name');
    let where = '';
    for (let i = 0; i < 150 && !where.startsWith('r'); i += 1) {
      await page.keyboard.press('Tab');
      where = await focusedCell(page);
    }
    // Tab skips the row checkboxes and lands on the first data cell.
    expect(where).toBe(`r0c${firstCol}`);
    await page.keyboard.press('Shift+Tab');
    const outsideBody = await page.evaluate(() => !document.activeElement?.closest('tbody'));
    expect(outsideBody).toBe(true);
  });

  test('arrow keys reach the checkbox cell; Space toggles its row and Shift+Space selects a range', async ({ page }) => {
    const firstCol = await colIndexOf(page, 'name');
    await getDataCell(page, 1, 'name').click();
    await page.keyboard.press('ArrowLeft');
    expect(await focusedCell(page)).toBe('r1c0');
    expect(await tabStopCount(page)).toBe(1);

    await page.keyboard.press('Space');
    await expectSelectedRowCount(page, 1);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    expect(await focusedCell(page)).toBe('r3c0');
    await page.keyboard.press('Shift+Space');
    await expectSelectedRowCount(page, 3);
    expect(await focusedCell(page)).toBe('r3c0');

    await page.keyboard.press('ArrowRight');
    expect(await focusedCell(page)).toBe(`r3c${firstCol}`);
  });
});

test.describe('Roving focus with virtual scrolling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?virtual');
    await waitForGrid(page);
  });

  test('focus stays in the grid while the focused row is scrolled away, and returns to it', async ({ page }) => {
    const nameCol = await colIndexOf(page, 'name');
    const region = getGridRegion(page);
    await getDataCell(page, 3, 'name').click();
    expect(await focusedCell(page)).toBe(`r3c${nameCol}`);
    // Let the click's scroll-into-view frame run before scrolling away.
    await page.waitForTimeout(100);

    await region.evaluate((el) => { el.scrollTop = el.scrollHeight / 2; });
    await expect.poll(() => focusedCell(page)).toBe('wrapper');
    await expect(region).toHaveAttribute('tabindex', '0');
    expect(await tabStopCount(page)).toBe(0);

    await region.evaluate((el) => { el.scrollTop = 0; });
    await expect.poll(() => focusedCell(page)).toBe(`r3c${nameCol}`);
    await expect(region).toHaveAttribute('tabindex', '-1');
  });

  test('keys pressed while the focused row is scrolled away move focus back into a cell', async ({ page }) => {
    const nameCol = await colIndexOf(page, 'name');
    const region = getGridRegion(page);
    await getDataCell(page, 3, 'name').click();
    await page.waitForTimeout(100);
    await region.evaluate((el) => { el.scrollTop = el.scrollHeight / 2; });
    await expect.poll(() => focusedCell(page)).toBe('wrapper');

    await page.keyboard.press('ArrowDown');
    await expect.poll(() => focusedCell(page)).toBe(`r4c${nameCol}`);

    // Jump to the last row (deep in the virtual range) and back to the top.
    await page.keyboard.press('Control+End');
    await expect.poll(() => focusedCell(page)).toMatch(/^r4999c\d+$/);
    await page.keyboard.press('Control+Home');
    await expect.poll(() => focusedCell(page)).toBe(`r0c${nameCol}`);
  });
});

test.describe('Roving focus with premium popover editors', () => {
  test('a portaled editor takes focus and hands it back to the cell on Escape and on commit', async ({ page }) => {
    await page.goto('/?premiumInputs');
    await waitForGrid(page);
    const ratingCol = await colIndexOf(page, 'rating');
    await getDataCell(page, 1, 'rating').click();
    await page.keyboard.press('Enter');
    // The editor renders in a portal outside the grid.
    await expect.poll(() => page.evaluate(() => !document.activeElement?.closest('[role="region"]'))).toBe(true);
    await page.keyboard.press('Escape');
    await expect.poll(() => focusedCell(page)).toBe(`r1c${ratingCol}`);

    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => !document.activeElement?.closest('[role="region"]'))).toBe(true);
    await page.keyboard.press('Enter');
    await expect.poll(() => focusedCell(page)).toBe(`r2c${ratingCol}`);
  });
});
