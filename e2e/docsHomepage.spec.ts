import { expect, test } from '@playwright/test';

test('docs homepage hero grid stays clipped and edit height stays stable', async ({ page }) => {
  await page.goto('.', { waitUntil: 'networkidle' });
  // The hero grid renders on the client after the static page has loaded.
  await expect(page.locator('[class*="heroGridWrapper"] table')).toBeVisible({ timeout: 15_000 });

  const heroMetrics = await page.evaluate(() => {
    const heroGridWrapper = document.querySelector('[class*="heroGridWrapper"]');
    const heroGridChild = heroGridWrapper?.firstElementChild ?? null;
    const heroGridGrandchild = heroGridChild?.firstElementChild ?? null;
    const heroInner = document.querySelector('[class*="heroInner"]');
    const heroRight = document.querySelector('[class*="heroRight"]');
    const tableWrapper = document.querySelector('[class*="tableWrapper"]');

    const rect = (element: Element | null) => {
      if (!element) return null;
      const bounds = element.getBoundingClientRect();
      return {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      };
    };

    const radius = (element: Element | null) => {
      if (!element) return 0;
      return Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
    };

    const bottomGap = (outer: Element | null, inner: Element | null) => {
      if (!outer || !inner) return null;
      return Math.abs(outer.getBoundingClientRect().bottom - inner.getBoundingClientRect().bottom);
    };

    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      heroGridWrapper: rect(heroGridWrapper),
      heroGridChild: rect(heroGridChild),
      heroGridGrandchild: rect(heroGridGrandchild),
      heroInner: rect(heroInner),
      heroRight: rect(heroRight),
      tableWrapper: rect(tableWrapper),
      heroGridOverflow: heroGridWrapper ? getComputedStyle(heroGridWrapper).overflow : null,
      heroGridRadius: radius(heroGridWrapper),
      heroGridChildRadius: radius(heroGridChild),
      heroGridChildBottomGap: bottomGap(heroGridWrapper, heroGridChild),
      heroGridGrandchildBottomGap: bottomGap(heroGridWrapper, heroGridGrandchild),
    };
  });

  expect(heroMetrics.documentWidth).toBeLessThanOrEqual(heroMetrics.viewportWidth);
  expect(heroMetrics.heroRight?.x ?? 0).toBeGreaterThanOrEqual(0);
  expect((heroMetrics.heroRight?.x ?? 0) + (heroMetrics.heroRight?.width ?? 0)).toBeLessThanOrEqual(heroMetrics.viewportWidth);
  expect((heroMetrics.tableWrapper?.x ?? 0) + (heroMetrics.tableWrapper?.width ?? 0)).toBeLessThanOrEqual(heroMetrics.viewportWidth);
  expect(heroMetrics.heroGridOverflow).toBe('hidden');
  expect(heroMetrics.heroGridRadius).toBeGreaterThan(0);
  expect(heroMetrics.heroGridChildRadius).toBeGreaterThan(0);
  expect(heroMetrics.heroGridChildBottomGap ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(2);
  expect(heroMetrics.heroGridGrandchildBottomGap ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(2);

  await page.locator('button[title="Comfortable density"]').click();

  const editableCell = page.getByRole('gridcell', { name: /Product Manager|Backend Developer/i }).first();
  const before = await editableCell.boundingBox();
  expect(before).not.toBeNull();

  await editableCell.dblclick();
  await page.waitForTimeout(200);

  const after = await editableCell.boundingBox();
  expect(after).not.toBeNull();
  expect(after?.width).toBe(before?.width);
  expect(after?.height).toBe(before?.height);
});

test('XLSX demo toolbar fits 790px with keyboard access to every group', async ({ page }) => {
  await page.goto('docs/features/xlsx-import');
  const demo = page.locator('.live-demo').first();
  await demo.evaluate(el => { (el as HTMLElement).style.width = '790px'; });
  const toolbar = demo.getByRole('toolbar', { name: 'Cell formatting' });
  await expect(toolbar).toBeVisible();
  await expect.poll(async () => toolbar.evaluate(el => {
    const buttons = Array.from(el.querySelectorAll<HTMLElement>('[data-xtb-item]'));
    return Math.max(...buttons.map(b => b.getBoundingClientRect().top)) - Math.min(...buttons.map(b => b.getBoundingClientRect().top));
  })).toBeLessThan(2);
  const cell = demo.locator('tbody [data-row-index][data-col-index]').first();
  await cell.click();
  const font = toolbar.getByRole('button', { name: 'Font', exact: true });
  await font.focus();
  await font.press('Enter');
  await expect(page.getByRole('menuitemradio', { name: 'Default font', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(font).toBeFocused();
  await font.press('ArrowRight');
  await expect(toolbar.getByRole('button', { name: 'Font size', exact: true })).toBeFocused();
  await expect(demo.getByRole('button', { name: 'Insert order row' })).toHaveCSS('border-radius', '6px');
});

test('drag demo instructions use the shared controls typography', async ({ page }) => {
  await page.goto('docs/features/drag-and-drop');
  const instructions = page.getByText(/Drag the row handle to reorder/);
  await expect(instructions).toBeVisible();
  expect(await instructions.evaluate(el => {
    const controls = el.closest('.live-demo__controls');
    if (!controls) return false;
    return getComputedStyle(el).color === getComputedStyle(controls).color && getComputedStyle(el).fontFamily === getComputedStyle(controls).fontFamily;
  })).toBe(true);
});
