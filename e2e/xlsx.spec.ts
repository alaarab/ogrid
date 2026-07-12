// XLSX example mode (?xlsx=1): a two-sheet workbook built in-browser and
// rendered via XlsxWorkbookGrid. Verifies the parse → grid path, the sheet
// tab bar, and sheet switching in both UI-kit example apps.
import { expect, test } from '@playwright/test';

test.describe('xlsx workbook grid', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?xlsx=1');
    await page.getByTestId('xlsx-example').waitFor({ state: 'visible' });
  });

  test('renders the first sheet of the workbook', async ({ page }) => {
    // Orders sheet: header promoted, first order row visible.
    await expect(page.getByText('1001', { exact: true }).first()).toBeVisible();
    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(0)).toHaveText('Orders');
    await expect(tabs.nth(1)).toHaveText('Summary');
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
  });

  test('switches sheets via the tab bar', async ({ page }) => {
    await page.getByRole('tab', { name: 'Summary' }).click();
    await expect(page.getByRole('tab', { name: 'Summary' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByText('Metric', { exact: true }).first()).toBeVisible();
    // The Summary sheet's cached formula result renders on first paint.
    await expect(page.getByText('15', { exact: true }).first()).toBeVisible();
  });
});
