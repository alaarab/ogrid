import { expect, test } from '@playwright/test';
import {
  applyFilter,
  clearFilter,
  enterCellEdit,
  enterDateCellEdit,
  getColumnTexts,
  getDefaultPageSize,
  getFramework,
  getRows,
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
    await expect(getRows(page)).toHaveCount(getDefaultPageSize(page));
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
    await expect(getRows(page)).toHaveCount(getDefaultPageSize(page));
  });

  test('edits a cell and commits the new value', async ({ page }) => {
    if (['vue-vuetify', 'vue-primevue'].includes(getFramework(page))) {
      const input = await enterDateCellEdit(page, 0, 5);
      await input.clear();
      await input.fill('2026-12-31');
      await input.press('Enter');

      await expect.poll(async () => {
        const [value = ''] = await getColumnTexts(page, 'startDate');
        return value;
      }).toContain('2026-12-31');
      return;
    }

    const input = await enterCellEdit(page, 0, 0);
    await input.fill('Smoke Edit');
    await input.press('Enter');

    await expect.poll(async () => {
      const values = await getColumnTexts(page, 'name');
      return values.some((value) => value.includes('Smoke Edit'));
    }).toBe(true);
  });
});
