/**
 * Filtering for report-style grids: the toolbar quick filter (`quickFilterBox`)
 * and the number comparison filter (`filterable: { type: 'number' }`).
 * Runs in both kits.
 */

import { test, expect, type Page } from '@playwright/test';
import { waitForGrid, getColumnTexts } from './helpers';

const toNumber = (text: string) => Number(text.replace(/[^0-9.-]/g, ''));

/** Filtered row count from the pager ("... of 137 projects"). */
async function rowTotal(page: Page): Promise<number> {
  const text = await page.getByText(/of\s+[\d,]+\s+projects/).first().textContent();
  return toNumber(/of\s+([\d,]+)\s+projects/.exec(text ?? '')?.[1] ?? 'NaN');
}

test.describe('Quick filter box', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?quickFilter');
    await waitForGrid(page);
  });

  test('typing filters rows across columns; Escape clears', async ({ page }) => {
    const total = await rowTotal(page);
    const box = page.getByRole('searchbox', { name: 'Search all columns' });
    const owner = (await getColumnTexts(page, 'owner'))[0] ?? '';
    const firstName = owner.split(' ')[0] ?? '';
    expect(firstName).not.toBe('');

    await box.fill(firstName.toLowerCase());
    await expect.poll(() => rowTotal(page)).toBeLessThan(total);
    for (const text of await getColumnTexts(page, 'owner')) expect(text).toContain(firstName);

    await box.press('Escape');
    await expect(box).toHaveValue('');
    await expect.poll(() => rowTotal(page)).toBe(total);
  });

  test('every term must match: a nonsense term empties the grid', async ({ page }) => {
    const box = page.getByRole('searchbox', { name: 'Search all columns' });
    await box.fill('zzqqxx-no-such-text');
    await box.press('Enter');
    await expect(page.locator('tbody td[data-column-id="owner"]')).toHaveCount(0);
  });
});

test.describe('Number comparison filter', () => {
  test('less than keeps only smaller values and the filter can be cleared', async ({ page }) => {
    await page.goto('/?numberFilter');
    await waitForGrid(page);
    const total = await rowTotal(page);

    await page.getByRole('button', { name: 'Filter Budget' }).click();
    await page.getByRole('combobox', { name: 'Budget condition 1' }).selectOption('lessThan');
    const value = page.getByRole('spinbutton', { name: 'Budget condition 1 value' });
    await value.fill('50000');
    await value.press('Enter');

    await expect.poll(() => rowTotal(page)).toBeLessThan(total);
    const budgets = (await getColumnTexts(page, 'budget')).map(toNumber);
    expect(budgets.length).toBeGreaterThan(0);
    for (const b of budgets) expect(b).toBeLessThan(50000);

    await page.getByRole('button', { name: 'Filter Budget' }).click();
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect.poll(() => rowTotal(page)).toBe(total);
  });
});

test.describe('Multi-select match mode', () => {
  test('None of excludes the chosen status', async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
    const total = await rowTotal(page);
    const first = ((await getColumnTexts(page, 'status'))[0] ?? '').trim();
    expect(first).not.toBe('');

    await page.getByRole('button', { name: 'Filter Status' }).click();
    await page.getByRole('combobox', { name: 'Status match' }).selectOption('none');
    // The filter popover holds the match select; the side bar has its own Status checkboxes.
    const popover = page.locator('[data-ogrid-multiselect-mode]').locator('..');
    await popover.getByRole('checkbox', { name: first, exact: true }).click();
    await popover.getByRole('button', { name: 'Apply' }).click();

    await expect.poll(() => rowTotal(page)).toBeLessThan(total);
    for (const text of await getColumnTexts(page, 'status')) expect(text.trim()).not.toBe(first);
  });
});
