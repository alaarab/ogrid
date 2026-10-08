import { expect, test } from '@playwright/test';
import { waitForGrid } from './helpers';

test('range handle stays on a sticky column through scrolling and virtual row mounts', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 });
  await page.goto('/?pinned=1&rangeMove=1&virtual=1');
  await waitForGrid(page);
  const region = page.locator('[data-ogrid-scroll-container]').first();
  const cell = region.locator('tbody tr[data-row-id] td[data-column-id] [data-row-index="0"]').first();
  await expect.poll(() => cell.evaluate(el => {
    const td = el.closest('td');
    return td && getComputedStyle(td).position;
  })).toBe('sticky');
  await cell.click();
  const handle = region.locator('[data-ogrid-range-move-handle]');
  await expect(handle).toBeVisible();
  const distance = async () => {
    const a = await cell.boundingBox();
    const b = await handle.boundingBox();
    if (!a || !b) return Infinity;
    return Math.hypot(b.x + b.width / 2 - a.x, b.y + b.height / 2 - a.y);
  };
  await expect.poll(distance).toBeLessThan(2);
  await region.evaluate(el => { el.scrollLeft = 100; });
  await expect.poll(() => region.evaluate(el => el.scrollLeft)).toBe(100);
  await expect.poll(distance).toBeLessThan(2);
  await page.setViewportSize({ width: 900, height: 800 });
  await expect.poll(distance).toBeLessThan(2);
  await region.evaluate(el => { el.scrollTop = 2000; });
  await expect(cell).toHaveCount(0);
  await expect(handle).toHaveCount(0);
  await region.evaluate(el => { el.scrollTop = 0; });
  await expect.poll(distance).toBeLessThan(2);
});
