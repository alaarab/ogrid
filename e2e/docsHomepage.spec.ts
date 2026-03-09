import { expect, test } from '@playwright/test';

test('docs homepage hero grid stays clipped and edit height stays stable', async ({ page }) => {
  const docsUrl = process.env.OGRID_DOCS_URL;
  test.skip(!docsUrl, 'Docs homepage coverage requires OGRID_DOCS_URL or a dedicated docs Playwright project.');

  await page.goto(docsUrl!, { waitUntil: 'networkidle' });

  const heroMetrics = await page.evaluate(() => {
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

    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      heroInner: rect(heroInner),
      heroRight: rect(heroRight),
      tableWrapper: rect(tableWrapper),
    };
  });

  expect(heroMetrics.documentWidth).toBeLessThanOrEqual(heroMetrics.viewportWidth);
  expect(heroMetrics.heroRight?.x ?? 0).toBeGreaterThanOrEqual(0);
  expect((heroMetrics.heroRight?.x ?? 0) + (heroMetrics.heroRight?.width ?? 0)).toBeLessThanOrEqual(heroMetrics.viewportWidth);
  expect((heroMetrics.tableWrapper?.x ?? 0) + (heroMetrics.tableWrapper?.width ?? 0)).toBeLessThanOrEqual(heroMetrics.viewportWidth);

  const editableCell = page.getByRole('gridcell', { name: /Product Manager|Backend Developer/i }).first();
  const before = await editableCell.boundingBox();
  expect(before).not.toBeNull();

  await editableCell.dblclick();
  await page.waitForTimeout(200);

  const after = await editableCell.boundingBox();
  expect(after).not.toBeNull();
  expect(after?.height).toBe(before?.height);
});
