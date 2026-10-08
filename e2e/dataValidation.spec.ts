import { expect, test, type Locator } from '@playwright/test';

// biome-ignore lint/suspicious/noUndeclaredEnvVars: direct Playwright invocation, outside the Turbo task cache
const docsUrl = process.env.OGRID_DOCS_URL;

for (const theme of ['light', 'dark']) test(`context menu validation dialog is visible and focusable in ${theme} mode`, async ({ page }) => {
  await page.addInitScript(value => localStorage.setItem('ogrid-theme', value), theme);
  await page.goto('/?validation');
  const cell = page.locator('tbody tr[data-row-id="0"] td[data-column-id="status"]');
  await cell.click();
  await page.keyboard.press('Shift+ArrowDown');
  await cell.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Data validation…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await expect(dialog).toBeVisible({ timeout: 1500 });
  const settings = dialog.getByRole('tab', { name: 'Settings', exact: true });
  await expect(settings).toBeVisible();
  await settings.focus();
  await expect(settings).toBeFocused();
  expect(await dialog.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + 20)); })).toBe(true);
});

async function expectInsetCircle(cell: Locator) {
  const bounds = await cell.evaluate(el => {
    const marker = el.querySelector('[data-validation-invalid]');
    if (!marker) throw new Error('Invalid data circle is missing');
    const cell = el.getBoundingClientRect(), circle = marker.getBoundingClientRect();
    return { left: circle.left - cell.left, right: cell.right - circle.right, top: circle.top - cell.top, bottom: cell.bottom - circle.bottom };
  });
  await test.info().attach('circle-insets', { body: JSON.stringify(bounds), contentType: 'application/json' });
  for (const inset of Object.values(bounds)) expect(inset).toBeLessThanOrEqual(5);
  expect(bounds.left).toBeGreaterThanOrEqual(2);
  expect(bounds.right).toBeGreaterThanOrEqual(2);
  expect(bounds.top).toBeGreaterThanOrEqual(2);
  expect(bounds.bottom).toBeGreaterThanOrEqual(2);
  expect(Math.abs(bounds.left - bounds.right)).toBeLessThan(2);
  expect(Math.abs(bounds.top - bounds.bottom)).toBeLessThan(2);
}

test('invalid circles stay inset and centered on pinned frozen cells while scrolling', async ({ page }) => {
  await page.goto('/?validation');
  const cell = page.locator('tbody tr[data-row-id="0"] td[data-column-id="quantity"]');
  await expect(cell.locator('[data-validation-invalid]')).toBeVisible();
  await expectInsetCircle(cell);
  const unpinned = page.locator('tbody tr[data-row-id="0"] td[data-column-id="status"]');
  await expectInsetCircle(unpinned);
  await page.locator('[data-ogrid-scroll-container]').evaluate(el => { el.scrollTop = 300; el.scrollLeft = 250; });
  await expectInsetCircle(cell);
  await expectInsetCircle(unpinned);
  await expect(cell.locator('[data-validation-invalid]')).toBeVisible();
});

// The docs suite can supply its running docs server to exercise the actual MDX demo.
test('docs validation demo opens its dialog and centers invalid circles', async ({ page }) => {
  test.skip(!docsUrl, 'Run with the built documentation server');
  await page.goto(`${docsUrl}/docs/features/data-validation`);
  const cell = page.locator('.live-demo tbody tr[data-row-id="1"] td[data-column-id="quantity"]');
  await cell.click();
  await page.keyboard.press('Shift+ArrowDown');
  await cell.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Data validation…' }).click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 1500 });
  await page.getByRole('tab', { name: 'Settings' }).focus();
  await expect(page.getByRole('tab', { name: 'Settings' })).toBeFocused();
});

test('docs invalid circle is centered on the ordinary quantity cell', async ({ page }) => {
  test.skip(!docsUrl, 'Run with the built documentation server');
  await page.goto(`${docsUrl}/docs/features/data-validation`);
  const cell = page.locator('.live-demo tbody tr[data-row-id="2"] td[data-column-id="quantity"]');
  await expect(cell.locator('[data-validation-invalid]')).toBeVisible();
  await expectInsetCircle(cell);
  await page.evaluate(() => window.scrollBy(0, 180));
  await expectInsetCircle(cell);
});

test('a delayed validation dialog download shows a focusable loading surface', async ({ page }) => {
  let release: (() => void) | undefined;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  await page.route(/DataValidationDialog[^/]*\.js/, async route => { await waiting; await route.continue(); });
  await page.goto('/?validation');
  const cell = page.locator('tbody tr[data-row-id="0"] td[data-column-id="status"]');
  await cell.click(); await cell.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Data validation…' }).click();
  const loading = page.getByRole('dialog', { name: 'Data validation', exact: true });
  try {
    await expect(loading).toBeVisible({ timeout: 1500 });
    await expect(loading).toHaveAttribute('aria-busy', 'true');
    await expect(loading.getByRole('button', { name: 'Cancel' })).toBeFocused();
  } finally { release?.(); }
  await expect(loading.getByRole('tab', { name: 'Settings' })).toBeVisible();
});
