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

for (const wideFont of [false, true]) {
  test(`XLSX demo toolbar fits 790/600/420px with keyboard access to every group${wideFont ? ' with wide fallback fonts' : ''}`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('docs/features/xlsx-import');
    const demo = page.locator('.live-demo').first();
    await demo.evaluate(el => { (el as HTMLElement).style.width = '790px'; });
    const toolbar = demo.getByRole('toolbar', { name: 'Cell formatting' });
    await expect(toolbar).toBeVisible();
    // Change fonts after mount, without resizing the host: intrinsic width
    // changes must also update overflow. Monospace stays wide across runners.
    if (wideFont) await page.addStyleTag({ content: `
      :root { --ifm-font-family-base: 'DejaVu Sans Mono', 'Courier New', monospace; }
      .ogrid-xtb { font-family: 'DejaVu Sans Mono', 'Courier New', monospace !important; }
    ` });
    const expectSingleRow = async (width: number) => {
      await expect.poll(async () => toolbar.evaluate(el => {
        const bounds = el.getBoundingClientRect();
        const controls = Array.from(el.querySelectorAll<HTMLElement>('[data-xtb-item]'))
          .filter(button => button.checkVisibility({ visibilityProperty: true })).map(button => button.getBoundingClientRect());
        return Math.max(
          Math.max(...controls.map(b => b.top)) - Math.min(...controls.map(b => b.top)),
          bounds.left - Math.min(...controls.map(b => b.left)),
          Math.max(...controls.map(b => b.right)) - bounds.right,
        );
      }), { message: `Toolbar controls fit one row at ${width}px` }).toBeLessThan(2);
    };
    await expectSingleRow(790);
    await demo.locator('tbody [data-row-index][data-col-index]').first().click();
    const font = toolbar.getByRole('button', { name: 'Font', exact: true });
    await font.focus();
    await font.press('Enter');
    await expect(page.getByRole('menuitemradio', { name: 'Default font', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(font).toBeFocused();
    await font.press('ArrowRight');
    await expect(toolbar.getByRole('button', { name: 'Font size', exact: true })).toBeFocused();
    // Long workbook font names retain compact triggers.
    await font.press('Enter');
    const longFont = page.getByRole('menuitemradio', { name: 'Times New Roman', exact: true });
    await longFont.focus();
    await longFont.press('Enter');
    await expect(font).toHaveAttribute('title', 'Font: Times New Roman');
    await expectSingleRow(790);

    const allControls = ['Undo', 'Redo', 'Font', 'Font size', 'Bold', 'Italic', 'Underline', 'Strikethrough', 'Fill color', 'Font color', 'Align left', 'Align center', 'Align right', 'Borders', 'Number format', 'Merge cells', 'Unmerge cells', 'Export .xlsx'];
    const labels = async (enabledOnly: boolean) => toolbar.evaluate((el, enabledOnly) =>
      Array.from(el.querySelectorAll<HTMLButtonElement>('[data-xtb-item]'))
        .filter(button => button.checkVisibility({ visibilityProperty: true }) && (!enabledOnly || !button.disabled))
        .map(button => button.getAttribute('aria-label') ?? ''), enabledOnly);
    const more = toolbar.getByRole('button', { name: 'More', exact: true });
    const overflow = toolbar.getByRole('dialog', { name: 'More formatting options' });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme);
      // Resize the host only; widening must restore overflowed controls too.
      for (const width of [790, 600, 420, 1200, 790]) {
        await demo.evaluate((el, width) => { (el as HTMLElement).style.width = `${width}px`; }, width);
        await expectSingleRow(width);
        await expect.poll(() => toolbar.evaluate(el => el.contains(document.activeElement))).toBe(true);
        await expect(toolbar.getByRole('button', { name: 'Export .xlsx', exact: true })).toBeVisible();
        await expect(font).toBeVisible();
        await expect(toolbar.getByRole('button', { name: 'Font size', exact: true })).toBeVisible();
        if (width === 1200) await expect(more).toHaveCount(0);
        else await expect(more).toBeVisible();
        const visibleLabels = await labels(false);
        const priority = ['Merge cells', 'Borders', 'Align left', 'Number format'];
        for (const [index, name] of priority.entries()) {
          if (visibleLabels.includes(name)) expect(visibleLabels).toEqual(expect.arrayContaining(priority.slice(index)));
        }
        const mainKeys = await labels(true);
        await toolbar.getByRole('button', { name: mainKeys[0], exact: true }).focus();
        for (const name of mainKeys.slice(1)) {
          await page.keyboard.press('ArrowRight');
          await expect(toolbar.getByRole('button', { name, exact: true })).toBeFocused();
        }
        await page.keyboard.press('Home');
        await expect(toolbar.getByRole('button', { name: mainKeys[0], exact: true })).toBeFocused();
        await page.keyboard.press('End');
        await expect(toolbar.getByRole('button', { name: 'Export .xlsx', exact: true })).toBeFocused();
        if (await more.count()) {
          await more.focus();
          await more.press('Enter');
          await expect(overflow).toBeVisible();
          const hostBounds = await toolbar.boundingBox();
          const moreBounds = await overflow.boundingBox();
          expect(moreBounds?.x ?? 0).toBeGreaterThanOrEqual(hostBounds?.x ?? 0);
          expect((moreBounds?.x ?? 0) + (moreBounds?.width ?? 0)).toBeLessThanOrEqual((hostBounds?.x ?? 0) + (hostBounds?.width ?? 0));
          const overflowKeys = await overflow.evaluate(el => Array.from(el.querySelectorAll<HTMLButtonElement>('[data-xtb-item]')).filter(button => !button.disabled).map(button => button.getAttribute('aria-label') ?? ''));
          await expect(overflow.getByRole('button', { name: overflowKeys[0], exact: true })).toBeFocused();
          for (const name of overflowKeys.slice(1)) {
            await page.keyboard.press('ArrowRight');
            await expect(overflow.getByRole('button', { name, exact: true })).toBeFocused();
          }
          expect((await labels(false)).filter(name => name !== 'More').sort()).toEqual([...allControls].sort());
          // Nested picker Escape returns to its trigger inside More.
          const borders = overflow.getByRole('button', { name: 'Borders', exact: true });
          await borders.focus();
          await borders.press('Enter');
          await expect(toolbar.getByRole('button', { name: 'All borders', exact: true })).toBeFocused();
          await page.keyboard.press('Escape');
          await expect(borders).toBeFocused();
          await expect(overflow).toBeVisible();
          await page.keyboard.press('Escape');
          await expect(more).toBeFocused();
        } else expect(visibleLabels.sort()).toEqual([...allControls].sort());
      }
    }
    await expect(demo.getByRole('button', { name: 'Insert order row' })).toHaveCSS('border-radius', '6px');
  });
}

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
