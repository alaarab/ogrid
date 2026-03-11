import { test, expect, type Page } from '@playwright/test';
import { DEMO_PROJECT_COUNT } from '../packages/examples/src/shared/demoConfig';
import {
  activateCell,
  DEMO_COLUMN_INDEX,
  waitForGrid,
  getDefaultPageSize,
  getColumnTexts,
  sortColumn,
  clickNextPage,
  openFilter,
  applyFilter,
  getTextFilterInput,
  getDataCell,
  expectRenderedPageSize,
  expectSelectedRowCount,
} from './helpers';

async function startFormulaBarEdit(page: Page) {
  const input = page.getByRole('textbox', { name: /formula input/i }).first();
  await input.click();
  await expect.poll(async () =>
    input.evaluate((el) => !(el as HTMLInputElement).readOnly)
  ).toBe(true);
  return input;
}

async function applyProjectNameFilter(page: Page, value: string): Promise<void> {
  await openFilter(page, 'Project Name');
  await getTextFilterInput(page).fill(value);
  await applyFilter(page);
}

test.describe('Formula mode parity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?formulas=1&cellReferences=1');
    await waitForGrid(page);
  });

  test('initial formulas render computed values and expose formula text in the formula bar', async ({ page }) => {
    const formulaBar = page.getByRole('toolbar', { name: /formula bar/i }).first();
    await expect(formulaBar).toBeVisible();

    const budgetCell = getDataCell(page, 0, 'budget');
    await expect.poll(async () => ((await budgetCell.textContent()) ?? '').trim()).toContain('40');

    await activateCell(page, 0, DEMO_COLUMN_INDEX.budget);

    await expect(page.getByLabel(/active cell reference/i).first()).toHaveText(/[A-Z]+\d+/);
    await expect(page.getByRole('textbox', { name: /formula input/i }).first()).toHaveValue('=20+20');
  });

  test('commits formula-bar edits to the active data cell across frameworks', async ({ page }) => {
    await activateCell(page, 1, DEMO_COLUMN_INDEX.budget);

    const formulaInput = await startFormulaBarEdit(page);
    await formulaInput.fill('=21+21');
    await formulaInput.press('Enter');

    const updatedBudgetCell = getDataCell(page, 1, 'budget');
    await expect.poll(async () => ((await updatedBudgetCell.textContent()) ?? '').trim()).toContain('42');
  });
});

test.describe('Row selection parity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?rowSelection=1');
    await waitForGrid(page);
    await expectRenderedPageSize(page, getDefaultPageSize(page), { totalCount: DEMO_PROJECT_COUNT });
  });

  test('row checkboxes select rows and update the selected-row state', async ({ page }) => {
    await page.getByLabel(/select row/i).first().click();

    await expectSelectedRowCount(page, 1);
  });

  test('select-all marks the visible page as selected', async ({ page }) => {
    const visibleRows = getDefaultPageSize(page);
    await page.getByLabel(/select all rows/i).first().click();

    await expectSelectedRowCount(page, visibleRows);
  });
});

test.describe('Server-side data parity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?serverSide=1');
    await waitForGrid(page);
    await expectRenderedPageSize(page, getDefaultPageSize(page), { totalCount: DEMO_PROJECT_COUNT });
  });

  test('sorting reorders server-fetched rows', async ({ page }) => {
    const namesBefore = await getColumnTexts(page, 'name');
    await sortColumn(page, 'Project Name', 'descending');
    const namesAfter = await getColumnTexts(page, 'name');

    expect(namesAfter[0]).not.toBe(namesBefore[0]);
  });

  test('pagination fetches the next server page', async ({ page }) => {
    const namesBefore = await getColumnTexts(page, 'name');
    await clickNextPage(page);
    const namesAfter = await getColumnTexts(page, 'name');

    expect(namesAfter[0]).not.toBe(namesBefore[0]);
  });

  test('text filters narrow server-fetched rows', async ({ page }) => {
    await applyProjectNameFilter(page, 'Project A');

    const names = await getColumnTexts(page, 'name');
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(name.toLowerCase()).toContain('project a');
    }
  });
});
