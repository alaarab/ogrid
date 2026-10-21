/**
 * Header corner menu (`headerMenu`), column menu extras and the fullscreen
 * shortcut, in a real browser for both kits. The example turns them on with
 * `?headerMenu` and adds an Export submenu and a column item of its own.
 */
import { test, expect, type Page } from '@playwright/test';
import { waitForGrid } from './helpers';

const trigger = (page: Page) => page.getByRole('button', { name: 'Grid options' });

const isFixed = (page: Page) => page.evaluate(() => {
  let el = document.querySelector('[data-ogrid-scroll-container]') as HTMLElement | null;
  while (el && getComputedStyle(el).position !== 'fixed') el = el.parentElement;
  return el != null;
});

test.describe('Header corner menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?headerMenu');
    await waitForGrid(page);
  });

  test('replaces the toolbar row', async ({ page }) => {
    await expect(trigger(page)).toBeVisible();
    await expect(page.getByRole('button', { name: /column visibility/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Fullscreen', exact: true })).toHaveCount(0);

  });

  test('toggles a column, then enters and exits full screen', async ({ page }) => {
    const statusHeader = page.getByRole('columnheader', { name: /^Status/ });
    await expect(statusHeader).toBeVisible();
    await trigger(page).click();
    await page.getByRole('menuitem', { name: 'Columns', exact: true }).click();
    await page.getByRole('menuitemcheckbox', { name: /Status/ }).click();
    await expect(statusHeader).toHaveCount(0);
    await expect(page.getByRole('menuitemcheckbox', { name: /Status/ })).toHaveAttribute('aria-checked', 'false');
    await page.getByRole('menuitemcheckbox', { name: /Status/ }).click();
    await expect(statusHeader).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    await trigger(page).click();
    await page.getByRole('menuitem', { name: 'Full screen' }).click();
    await expect.poll(() => isFixed(page)).toBe(true);
    // A visible way out, with Escape and the shortcut in its tooltip.
    const exit = page.getByRole('button', { name: 'Exit full screen' });
    await expect(exit).toBeVisible();
    await expect(exit).toHaveAttribute('title', 'Exit full screen (Esc or F)');
    await exit.click();
    await expect.poll(() => isFixed(page)).toBe(false);
    await expect(exit).toHaveCount(0);
  });

  test('nothing in the grid renders under the corner button', async ({ page }) => {
    const overlap = await page.evaluate(() => {
      const scroller = document.querySelector('[data-ogrid-scroll-container]') as HTMLElement;
      scroller.scrollLeft = scroller.scrollWidth;
      const corner = document.querySelector('[data-ogrid-header-corner]') as HTMLElement;
      return scroller.getBoundingClientRect().right - corner.getBoundingClientRect().left;
    });
    expect(overlap).toBeLessThanOrEqual(0.5);
    // Scrolled to the end, the last column's options button is fully on screen.
    const lastMenu = page.locator('thead th[data-column-id]').last().locator('[data-ogrid-column-menu-trigger]');
    const onTop = await lastMenu.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.right - 2, r.top + r.height / 2));
    });
    expect(onTop).toBe(true);
  });

  test('opens a nested submenu from an app item', async ({ page }) => {
    await trigger(page).click();
    await page.getByRole('menuitem', { name: 'Export' }).hover();
    const csv = page.getByRole('menuitem', { name: 'CSV' });
    await expect(csv).toBeVisible();
    const download = page.waitForEvent('download');
    await csv.click();
    expect((await download).suggestedFilename()).toBe('projects.csv');
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('works from the keyboard: Enter opens, arrows move, Escape closes and returns focus', async ({ page }) => {
    await trigger(page).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Columns', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('searchbox', { name: 'Search columns' })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menuitem', { name: 'Columns', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(trigger(page)).toBeFocused();
  });

  test('f toggles full screen while the grid has focus', async ({ page }) => {
    // A header button: focus in the grid, not on an editable cell.
    await page.getByRole('button', { name: 'Owner column options' }).focus();
    await page.keyboard.press('f');
    await expect.poll(() => isFixed(page)).toBe(true);
    await page.keyboard.press('f');
    await expect.poll(() => isFixed(page)).toBe(false);
  });

  test('stays in the top-right corner while the grid scrolls sideways', async ({ page }) => {
    const box = async () => {
      const b = await trigger(page).boundingBox();
      if (!b) throw new Error('corner button has no box');
      return b;
    };
    const before = await box();
    const scrolled = await page.evaluate(() => {
      const w = document.querySelector('[data-ogrid-scroll-container]') as HTMLElement;
      w.scrollLeft = 300;
      return w.scrollLeft;
    });
    test.skip(scrolled === 0, 'grid fits without horizontal scroll at this size');
    const after = await box();
    expect(Math.abs(after.x - before.x)).toBeLessThan(1);
    expect(Math.abs(after.y - before.y)).toBeLessThan(1);
    // Topmost at its center: nothing (pinned or sticky header cells) draws over it.
    const onTop = await trigger(page).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
    });
    expect(onTop).toBe(true);
  });

  test('right-clicking a header offers Choose columns, Full screen and the app item', async ({ page }) => {
    await page.getByRole('columnheader', { name: /^Owner/ }).click({ button: 'right' });
    const menu = page.getByRole('menu', { name: 'Owner column options' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Choose columns' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Full screen' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Copy column id' })).toBeVisible();
    // The app moved "Autosize this column" to the top.
    await expect(menu.getByRole('menuitem').first()).toHaveText('Autosize this column');
  });
});
