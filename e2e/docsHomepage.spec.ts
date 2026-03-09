import { expect, test } from '@playwright/test';

test('docs homepage hero grid stays clipped and edit height stays stable', async ({ page }) => {
  const docsUrl = process.env.OGRID_DOCS_URL;
  test.skip(!docsUrl, 'Docs homepage coverage requires OGRID_DOCS_URL or a dedicated docs Playwright project.');
  if (!docsUrl) return;

  await page.goto(docsUrl, { waitUntil: 'networkidle' });

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
