import { test, expect, type Locator } from '@playwright/test';

async function boundingBox(locator: Locator) {
  const bounds = await locator.boundingBox();
  if (!bounds) throw new Error('Expected visible element bounds');
  return bounds;
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'react-radix', 'Radix mobile and portal behavior');
  await page.goto('/filter-options.html');
});

test('labels filter boolean rows and emit raw string values', async ({ page }) => {
  await page.getByRole('button', { name: 'Filter Status' }).click();
  await page.getByRole('checkbox', { name: 'Inactive', exact: true }).click();
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByTestId('filters')).toHaveText('{"active":{"type":"multiSelect","value":["false"]}}');
  await expect(page.getByRole('gridcell', { name: 'Past project', exact: true })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: 'Current project', exact: true })).toHaveCount(0);
});

test('All page size stays selected when a labeled boolean filter changes the total', async ({ page }) => {
  const pageSize = page.getByRole('combobox', { name: 'Rows per page' }).first();
  await pageSize.selectOption('all');
  await expect(page.getByRole('gridcell', { name: 'Current project', exact: true })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: 'Past project', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Filter Status' }).click();
  await page.getByRole('checkbox', { name: 'Inactive', exact: true }).click();
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(pageSize).toHaveValue('all');
  await expect(page.getByRole('gridcell', { name: 'Current project', exact: true })).toHaveCount(0);
  await expect(page.getByRole('gridcell', { name: 'Past project', exact: true })).toBeVisible();
  await expect(page.getByTestId('filters')).toHaveText('{"active":{"type":"multiSelect","value":["false"]}}');
});

test('portaled filter and chooser retain scoped dark colors and follow theme changes while open', async ({ page }) => {
  for (const trigger of [page.getByRole('button', { name: 'Filter Status' }), page.getByRole('button', { name: /Column Visibility/ })]) {
    await page.locator('main').evaluate((el) => el.setAttribute('data-theme', 'dark'));
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toHaveCSS('background-color', 'rgb(36, 28, 24)');
    await expect(dialog).toHaveCSS('color', 'rgb(255, 241, 229)');
    expect(await dialog.evaluate((el) => !el.closest('main'))).toBe(true);
    if (await dialog.locator('input[type="text"]').count()) {
      await expect(dialog.locator('input[type="text"]')).toHaveCSS('background-color', 'rgb(36, 28, 24)');
      await expect(dialog.locator('input[type="text"]')).toHaveCSS('color', 'rgb(255, 241, 229)');
    }
    await page.locator('main').evaluate((el) => el.setAttribute('data-theme', 'light'));
    await expect(dialog).toHaveCSS('background-color', 'rgb(255, 248, 239)');
    await expect(dialog).toHaveCSS('color', 'rgb(54, 38, 29)');
    await page.keyboard.press('Escape');
  }
});

test.describe('phone controls', () => {
  test.use({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true });

  async function expectTouchTarget(locator: Locator) {
    const bounds = await locator.boundingBox();
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
  }

  test('has 44px controls, non-overlapping virtual options, and menus within the viewport', async ({ page }) => {
    const filter = page.getByRole('button', { name: 'Filter Choice' });
    await expectTouchTarget(filter);
    await filter.click();
    const dialog = page.getByRole('dialog');
    const bounds = await boundingBox(dialog);
    expect(bounds.x).toBeGreaterThanOrEqual(11);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(309);
    expect(bounds.y).toBeGreaterThanOrEqual(11);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(557);
    const first = dialog.locator('label').filter({ hasText: /^Choice 1$/ });
    const second = dialog.locator('label').filter({ hasText: /^Choice 2$/ });
    await expectTouchTarget(first);
    const firstBounds = await boundingBox(first);
    expect((await boundingBox(second)).y).toBeGreaterThanOrEqual(firstBounds.y + firstBounds.height);
    await dialog.getByPlaceholder('Search...').fill('Choice 60');
    await dialog.getByRole('checkbox', { name: 'Choice 60', exact: true }).click();
    await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(page.getByTestId('selection')).toHaveText('["59"]');

    const pager = page.getByRole('region', { name: 'Many pages' });
    for (const control of await pager.locator('button, select').all()) await expectTouchTarget(control);
    expect(await pager.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await pager.getByRole('button', { name: 'Next page', exact: true }).click();
    await expect(pager.locator('[aria-current="page"]')).toHaveText('11');
    await page.getByRole('button', { name: /Column Visibility/ }).click();
    const chooserBounds = await boundingBox(page.getByRole('dialog'));
    expect(chooserBounds.x).toBeGreaterThanOrEqual(11);
    expect(chooserBounds.x + chooserBounds.width).toBeLessThanOrEqual(309);
  });
});
