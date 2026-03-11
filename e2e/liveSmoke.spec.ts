import { expect, test } from '@playwright/test';
import { DEMO_PROJECT_COUNT } from '../packages/examples/src/shared/demoConfig';
import {
  applyFilter,
  clearFilter,
  enterCellEdit,
  expectRenderedPageSize,
  getColumnTexts,
  getDefaultPageSize,
  getTextFilterInput,
  openFilter,
  sortColumn,
  waitForGrid,
} from './helpers';

test.describe('Live smoke suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('renders the shared demo grid', async ({ page }) => {
    const headers = await page.locator('thead th').allTextContents();
    const joined = headers.join(' ');

    expect(joined).toContain('Project Name');
    expect(joined).toContain('Status');
    expect(joined).toContain('Start Date');
    await expectRenderedPageSize(page, getDefaultPageSize(page), { totalCount: DEMO_PROJECT_COUNT });
  });

  test('sorts Project Name descending', async ({ page }) => {
    const before = await getColumnTexts(page, 'name');
    await sortColumn(page, 'Project Name', 'descending');
    const after = await getColumnTexts(page, 'name');

    expect(after.some((value, index) => value !== before[index])).toBe(true);
  });

  test('filters Project Name and clears the filter', async ({ page }) => {
    await openFilter(page, 'Project Name');
    await getTextFilterInput(page).fill('Project A');
    await applyFilter(page);

    const filteredNames = await getColumnTexts(page, 'name');
    expect(filteredNames.length).toBeGreaterThan(0);
    expect(filteredNames.length).toBeLessThan(getDefaultPageSize(page));
    for (const name of filteredNames) {
      expect(name.toLowerCase()).toContain('project a');
    }

    await openFilter(page, 'Project Name');
    await clearFilter(page);
    await expectRenderedPageSize(page, getDefaultPageSize(page), { totalCount: DEMO_PROJECT_COUNT });
  });

  test('edits a cell and commits the new value', async ({ page }) => {
    const input = await enterCellEdit(page, 0, 0);
    await input.fill('!Smoke Edit');
    await input.press('Enter');

    await expect.poll(async () => {
      const values = await getColumnTexts(page, 'name');
      return values.some((value) => value.includes('!Smoke Edit'));
    }).toBe(true);
  });
});
