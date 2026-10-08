import { expect, test, type Locator, type Page } from '@playwright/test';

// biome-ignore lint/suspicious/noUndeclaredEnvVars: direct Playwright invocation, outside the Turbo task cache
const docsUrl = process.env.OGRID_DOCS_URL;
const themes = ['light', 'dark'] as const;

async function openDocsDemo(page: Page, project: string, theme: typeof themes[number] = 'light') {
  await page.addInitScript(value => localStorage.setItem('theme', value), theme);
  await page.goto(`${docsUrl}/docs/features/data-validation`);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await page.getByRole('combobox', { name: 'UI kit' }).selectOption(project === 'react-fluent' ? 'fluent' : 'radix');
}

async function openConsumer(page: Page, theme: typeof themes[number]) {
  await page.addInitScript(value => localStorage.setItem('ogrid-theme', value), theme);
  await page.goto('/lazy-ui.html');
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

async function expectSurface(surface: Locator) {
  await expect(surface).toBeVisible();
  const style = await surface.evaluate(el => {
    const s = getComputedStyle(el);
    return { background: s.backgroundColor, border: s.borderTopStyle, shadow: s.boxShadow };
  });
  expect(style.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(style.background).not.toBe('transparent');
  expect(style.border === 'solid' || style.shadow !== 'none').toBe(true);
}

async function expectStyledDialog(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await expect(dialog.getByRole('tab', { name: 'Settings', exact: true })).toBeVisible();
  await expectSurface(dialog);
  const backdrop = await dialog.evaluate(el => {
    const node = el.tagName === 'DIALOG' ? el : document.querySelector('.fui-DialogSurface__backdrop');
    if (!node) return null;
    const s = getComputedStyle(node, el.tagName === 'DIALOG' ? '::backdrop' : null);
    return { background: s.backgroundColor, position: s.position };
  });
  expect(backdrop).not.toBeNull();
  expect(backdrop?.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(backdrop?.position).toBe('fixed');
  const uaBackground = await page.evaluate(() => {
    const button = document.createElement('button');
    document.body.append(button);
    const background = getComputedStyle(button).backgroundColor;
    button.remove();
    return background;
  });
  for (const name of ['Settings', 'Input message', 'Error alert']) {
    const tab = dialog.getByRole('tab', { name, exact: true });
    await tab.focus();
    await expect(tab).toBeFocused();
    expect(await tab.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(uaBackground);
  }
  for (const name of ['Clear all', 'Cancel', 'Apply']) {
    const button = dialog.getByRole('button', { name, exact: true });
    expect(await button.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(uaBackground);
  }
  const select = dialog.getByRole('combobox', { name: 'Allow', exact: true });
  expect(await select.evaluate(el => getComputedStyle(el).paddingTop)).not.toBe('0px');
}

async function expectInputMessage(page: Page, cell: Locator, invalidCell: Locator) {
  await cell.click();
  const tooltip = page.getByRole('tooltip').filter({ hasText: 'Enter a whole number from 1 to 10' });
  await expectSurface(tooltip);
  const bounds = await tooltip.boundingBox();
  const invalidBounds = await invalidCell.locator('[data-validation-invalid]').boundingBox();
  expect(bounds).not.toBeNull();
  expect(invalidBounds).not.toBeNull();
  if (!bounds || !invalidBounds) throw new Error('Tooltip or invalid circle is missing');
  const overlap = bounds.x < invalidBounds.x + invalidBounds.width && bounds.x + bounds.width > invalidBounds.x
    && bounds.y < invalidBounds.y + invalidBounds.height && bounds.y + bounds.height > invalidBounds.y;
  expect(overlap, 'The input message must not overlap the next quantity cell’s invalid circle').toBe(false);
  expect(await tooltip.evaluate(el => getComputedStyle(el).textAlign)).toBe('left');
  expect(await tooltip.evaluate(el => {
    const previous = el.style.pointerEvents;
    el.style.pointerEvents = 'auto';
    const r = el.getBoundingClientRect();
    const visible = [[r.left + 4, r.top + 4], [r.right - 4, r.bottom - 4]].every(([x, y]) => el.contains(document.elementFromPoint(x, y)));
    el.style.pointerEvents = previous;
    return visible;
  }), 'The prompt surface must paint above the grid without clipping').toBe(true);
}

async function expectFindInput(page: Page, cell: Locator) {
  await cell.click();
  await page.keyboard.press('Control+f');
  const panel = page.getByRole('search', { name: 'Find and replace' });
  await expectSurface(panel);
  const input = panel.getByRole('textbox', { name: 'Find', exact: true });
  await expect(input).toBeFocused();
  const style = await input.evaluate(el => {
    const s = getComputedStyle(el.closest('.fui-Input') ?? el);
    return { background: s.backgroundColor, radius: parseFloat(s.borderRadius), border: s.borderTopStyle };
  });
  expect(style.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(style.radius).toBeGreaterThan(0);
  expect(style.border).toBe('solid');
}

for (const theme of themes) {
  test(`built docs validation dialog controls are styled in ${theme} mode`, async ({ page }, testInfo) => {
    test.skip(!docsUrl, 'Run with the built documentation server');
    await openDocsDemo(page, testInfo.project.name, theme);
    const cell = page.locator('.live-demo tbody tr[data-row-id="1"] td[data-column-id="quantity"]');
    await cell.click();
    await cell.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Data validation…' }).click();
    await expectStyledDialog(page);
  });

  test(`built docs input message clears the invalid circle in ${theme} mode`, async ({ page }, testInfo) => {
    test.skip(!docsUrl, 'Run with the built documentation server');
    await openDocsDemo(page, testInfo.project.name, theme);
    await expectInputMessage(page,
      page.locator('.live-demo tbody tr[data-row-id="1"] td[data-column-id="quantity"]'),
      page.locator('.live-demo tbody tr[data-row-id="2"] td[data-column-id="quantity"]'));
  });

  test(`built docs find input is styled in ${theme} mode`, async ({ page }, testInfo) => {
    test.skip(!docsUrl, 'Run with the built documentation server');
    await openDocsDemo(page, testInfo.project.name, theme);
    await expectFindInput(page, page.locator('.live-demo tbody tr[data-row-id="1"] td[data-column-id="product"]'));
  });

  test(`consumer entry and CSS style the lazy validation dialog in ${theme} mode`, async ({ page }) => {
    const downloads: string[] = [];
    page.on('request', request => { if (/DataValidationDialog[^/]*\.js/.test(request.url())) downloads.push(request.url()); });
    await openConsumer(page, theme);
    const cell = page.locator('tbody tr[data-row-id="1"] td[data-column-id="quantity"]');
    await expect(cell).toBeVisible();
    expect(downloads).toHaveLength(0);
    await cell.click();
    await cell.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Data validation…' }).click();
    await expectStyledDialog(page);
    expect(downloads).toHaveLength(1);
  });

  test(`consumer prompt and invalid circles stay styled while scrolling in ${theme} mode`, async ({ page }) => {
    await openConsumer(page, theme);
    const cell = page.locator('tbody tr[data-row-id="0"] td[data-column-id="quantity"]');
    await expectInsetCircle(cell);
    await expectInputMessage(page, cell, page.locator('tbody tr[data-row-id="2"] td[data-column-id="quantity"]'));
    await page.locator('[data-ogrid-scroll-container]').evaluate(el => { el.scrollTop = 100; el.scrollLeft = 200; });
    await expectInputMessage(page, cell, page.locator('tbody tr[data-row-id="2"] td[data-column-id="quantity"]'));
    await expectInsetCircle(cell);
  });

  test(`consumer styles the find panel, note, formula help and drag menus in ${theme} mode`, async ({ page }) => {
    await openConsumer(page, theme);
    const cell = page.locator('tbody tr[data-row-id="0"] td[data-column-id="quantity"]');
    await expectFindInput(page, cell);
    await page.keyboard.press('Escape');
    const noted = page.locator('tbody tr[data-row-id="0"] td[data-column-id="description"]');
    await noted.click();
    await expectSurface(page.getByRole('tooltip').filter({ hasText: 'Consumer note' }));
    await cell.click();
    await cell.click({ button: 'right' });
    const freeze = page.getByRole('menuitem', { name: 'Freeze top row', exact: true });
    await expect(freeze).toBeVisible();
    expect(await freeze.evaluate(el => getComputedStyle(el).borderTopStyle)).not.toBe('outset');
    await page.keyboard.press('Escape');
    const handle = page.locator('[data-ogrid-row-drag-handle]').first();
    await expect(handle).toBeVisible();
    expect(await handle.evaluate(el => getComputedStyle(el).cursor)).toBe('grab');
    await noted.dblclick();
    const editor = noted.locator('input');
    await editor.fill('=SU');
    await expect(page.getByRole('listbox', { name: 'Formula suggestions' })).toBeVisible();
    await expectSurface(page.getByRole('listbox', { name: 'Formula suggestions' }).locator('..'));
  });

  test(`XLSX lazy toolbar and streaming controls are styled in ${theme} mode`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem('ogrid-theme', value), theme);
    await page.goto('/?xlsx=1');
    const bold = page.getByRole('button', { name: 'Bold', exact: true });
    await expect(bold).toBeVisible();
    expect(await bold.evaluate(el => parseFloat(getComputedStyle(el).borderRadius))).toBeGreaterThan(0);
    let release: (() => void) | undefined;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    await page.route(/xlsxWorker[^/]*\.js/, async route => { await waiting; await route.continue(); });
    await page.goto('/?xlsx=1&streaming');
    try {
      const progress = page.getByRole('progressbar', { name: 'Workbook loading' });
      await expect(progress).toBeVisible();
      await expect(progress).toHaveCSS('height', '8px');
      expect(await progress.evaluate(el => getComputedStyle(el).accentColor)).not.toBe('auto');
      const cancel = page.getByRole('button', { name: 'Cancel', exact: true });
      await expect(cancel).toHaveCSS('border-top-style', 'solid');
      await expect(cancel).toHaveCSS('padding-top', '4px');
      expect(await cancel.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
    } finally { release?.(); }
    await expect(page.getByRole('button', { name: 'Enable editing' })).toBeEnabled({ timeout: 20_000 });
  });
}

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
  const marker = cell.locator('[data-validation-invalid]');
  await expect(marker).toHaveCSS('border-top-style', 'solid');
  await expect(marker).toHaveCSS('border-top-width', '2px');
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
test('docs validation demo opens its dialog and centers invalid circles', async ({ page }, testInfo) => {
  test.skip(!docsUrl, 'Run with the built documentation server');
  await openDocsDemo(page, testInfo.project.name);
  const cell = page.locator('.live-demo tbody tr[data-row-id="1"] td[data-column-id="quantity"]');
  await cell.click();
  await page.keyboard.press('Shift+ArrowDown');
  await cell.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Data validation…' }).click();
  await expect(page.getByRole('dialog', { name: 'Data validation', exact: true })).toBeVisible({ timeout: 1500 });
  await page.getByRole('tab', { name: 'Settings' }).focus();
  await expect(page.getByRole('tab', { name: 'Settings' })).toBeFocused();
});

test('docs invalid circle is centered on the ordinary quantity cell', async ({ page }, testInfo) => {
  test.skip(!docsUrl, 'Run with the built documentation server');
  await openDocsDemo(page, testInfo.project.name);
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
