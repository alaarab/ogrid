/**
 * OGrid E2E test suite.
 *
 * Runs the shared grid-journey suite against the representative example apps
 * in the main Playwright matrix: React Fluent, React Material, React Radix,
 * Angular Material, Vue Radix, Vue Vuetify, and Vanilla JS.
 *
 * Each app renders the same demo data set with sorting, filtering, pagination,
 * cell editing, cell selection, and a status bar.
 *
 * Columns: Project Name | Status | Owner | Title | Email | Department | Budget | Start Date | Active
 * Page size: shared example config  |  Total rows: shared example config
 */

import { DEMO_PROJECT_COUNT } from '../packages/examples/src/shared/demoConfig';
import { test, expect } from '@playwright/test';
import {
  waitForGrid,
  getRows,
  getColumnTexts,
  getCellContent,
  getGridRegion,
  sortColumn,
  clickNextPage,
  clickPrevPage,
  changePageSize,
  clickPageNumber,
  openFilter,
  getFilterPopover,
  applyFilter,
  clearFilter,
  activateCell,
  DEMO_COLUMN_INDEX,
  openColumnChooser,
  openColumnOptions,
  rightClickCell,
  getStatusBar,
  getFillHandle,
  getResizeHandle,
  enterCellEdit,
  enterDateCellEdit,
  expectRenderedPageSize,
  getDefaultPageSize,
  expectActiveCellAt,
  getTextFilterInput,
  getOpenTextEditor,
  scrollGridVertically,
  dismissContextMenu,
  toggleColumnInChooser,
  closeColumnChooser,
  getContextMenu,
  getContextMenuItem,
  getDataCell,
  getCellContentByColumnId,
  getFramework,
  isJS,
} from './helpers';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Grid rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders the shared demo column headers', async ({ page }) => {
    await waitForGrid(page);
    const headers = await page.locator('thead th').allTextContents();
    const joined = headers.join(' ');
    expect(joined).toContain('Project Name');
    expect(joined).toContain('Status');
    expect(joined).toContain('Owner');
    expect(joined).toContain('Department');
    expect(joined).toContain('Budget');
    expect(joined).toContain('Start Date');
  });

  test('renders correct number of data rows on first page', async ({ page }) => {
    await waitForGrid(page);
    const expectedRows = getDefaultPageSize(page);
    await expectRenderedPageSize(page, expectedRows, { totalCount: DEMO_PROJECT_COUNT });
  });

  test('first row contains "Project A" as project name', async ({ page }) => {
    await waitForGrid(page);
    const names = await getColumnTexts(page, 'name');
    expect(names[0]).toContain('Project A');
  });

  test(`pagination info shows total count of ${DEMO_PROJECT_COUNT}`, async ({ page }) => {
    await waitForGrid(page);
    const pageSize = getDefaultPageSize(page);
    const info = page.locator(`text=/1.*to.*${pageSize}.*of.*${DEMO_PROJECT_COUNT}/i`).first();
    // Fallback: pagination copy varies slightly by framework.
    if (await info.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(info).toBeVisible();
    } else {
      const text = await page.locator('body').textContent();
      expect(text ?? '').toMatch(new RegExp(DEMO_PROJECT_COUNT.toLocaleString('en-US').replace(/,/g, '[,]?')));
    }
  });
});

test.describe('Sorting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('sort descending changes row order', async ({ page }) => {
    const namesBefore = await getColumnTexts(page, 'name');
    await sortColumn(page, 'Project Name', 'descending');
    const namesAfter = await getColumnTexts(page, 'name');
    const changed = namesAfter.some((n, i) => n !== namesBefore[i]);
    expect(changed).toBe(true);
  });

  test('sort ascending produces alphabetical order', async ({ page }) => {
    await sortColumn(page, 'Project Name', 'descending');
    const namesDesc = await getColumnTexts(page, 'name');

    // For React/Angular/Vue: sort ascending via menu
    // For JS: clicking again toggles, so we start fresh
    if (isJS(page)) {
      await page.goto('/');
      await waitForGrid(page);
      await sortColumn(page, 'Project Name', 'ascending');
    } else {
      await sortColumn(page, 'Project Name', 'ascending');
    }
    const namesAsc = await getColumnTexts(page, 'name');
    expect(namesAsc[0]).not.toBe(namesDesc[0]);
  });

  test('sorted column shows aria-sort attribute', async ({ page }) => {
    await sortColumn(page, 'Project Name', 'descending');
    const th = page.locator('thead th').filter({ hasText: 'Project Name' }).first();
    await expect(th).toHaveAttribute('aria-sort', 'descending');
  });
});

test.describe('Pagination', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('next page loads rows', async ({ page }) => {
    await clickNextPage(page);
    const pageSize = getDefaultPageSize(page);
    await expectRenderedPageSize(page, pageSize, {
      start: pageSize + 1,
      totalCount: DEMO_PROJECT_COUNT,
    });
  });

  test('navigating to last page shows final rows', async ({ page }) => {
    await clickNextPage(page);
    await clickNextPage(page);
    const count = await getRows(page).count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(getDefaultPageSize(page) + 15); // last page may have fewer
  });

  test('previous page navigates back', async ({ page }) => {
    await clickNextPage(page);
    await clickPrevPage(page);
    const names = await getColumnTexts(page, 'name');
    expect(names[0]).toContain('Project A');
  });

  test('changing page size to 50 shows 50 rows', async ({ page }) => {
    await changePageSize(page, 50);
    await expectRenderedPageSize(page, 50, { totalCount: DEMO_PROJECT_COUNT });
  });

  test('page number buttons navigate directly', async ({ page }) => {
    await clickPageNumber(page, 2);
    const names = await getColumnTexts(page, 'name');
    // Page 2 should not start with "Project A"
    expect(names[0]).not.toContain('Project A');
  });
});

test.describe('Text filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('filtering Project Name reduces visible rows', async ({ page }) => {
    await openFilter(page, 'Project Name');

    const input = getTextFilterInput(page);
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill('Project A');

    await applyFilter(page);

    const count = await getRows(page).count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(getDefaultPageSize(page));

    const names = await getColumnTexts(page, 'name');
    for (const name of names) {
      expect(name.toLowerCase()).toContain('project a');
    }
  });

  test('clearing text filter restores rows', async ({ page }) => {
    // Apply filter
    await openFilter(page, 'Project Name');
    await getTextFilterInput(page).fill('Project A');
    await applyFilter(page);

    const filteredCount = await getRows(page).count();
    expect(filteredCount).toBeLessThan(getDefaultPageSize(page));

    // Clear filter
    await openFilter(page, 'Project Name');
    await clearFilter(page);

    await expectRenderedPageSize(page, getDefaultPageSize(page), { totalCount: DEMO_PROJECT_COUNT });
  });
});

test.describe('MultiSelect filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('filtering Status by "Active" shows only active rows', async ({ page }) => {
    await openFilter(page, 'Status');

    if (isJS(page)) {
      const clearSelection = page.locator('.ogrid-filter-clear-sel-btn').first();
      if (await clearSelection.isVisible().catch(() => false)) {
        await clearSelection.click();
      }
      // JS: checkboxes in .ogrid-filter-checkbox-list
      const checkbox = page.locator('.ogrid-filter-checkbox-list label').filter({ hasText: 'Active' }).locator('input');
      await checkbox.click();
    } else {
      // React/Angular/Vue: dialog or popover with checkboxes
      const popover = getFilterPopover(page);
      await expect(popover).toBeVisible({ timeout: 2000 });
      const clearSelection = popover.getByRole('button', { name: /^clear$/i }).first();
      if (await clearSelection.isVisible().catch(() => false)) {
        await clearSelection.click();
      }
      const activeLabel = popover.locator('label').filter({ hasText: /^Active$/i }).first();
      if (await activeLabel.isVisible().catch(() => false)) {
        const labelledCheckbox = activeLabel.locator('xpath=preceding-sibling::*[@role="checkbox"][1]').first();
        const labelledInput = activeLabel.locator('xpath=preceding-sibling::input[@type="checkbox"][1]').first();
        if (await labelledCheckbox.isVisible().catch(() => false)) {
          await labelledCheckbox.click();
        } else if (await labelledInput.isVisible().catch(() => false)) {
          await labelledInput.click();
        } else {
          await activeLabel.click();
        }
      } else {
        // Vue Vuetify uses input[type="checkbox"] with aria-label (no role="checkbox").
        const activeCheckbox = (await popover.getByRole('checkbox', { name: /active/i }).count()) > 0
          ? popover.getByRole('checkbox', { name: /active/i }).first()
          : popover.locator('input[type="checkbox"][aria-label*="Active" i], input[type="checkbox"]').first();
        await activeCheckbox.click();
      }
    }

    await applyFilter(page);

    const statuses = await getColumnTexts(page, 'status');
    expect(statuses.length).toBeGreaterThan(0);
    for (const s of statuses) {
      expect(s.trim()).toBe('Active');
    }
  });
});

test.describe('Column visibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('column chooser hides a column', async ({ page }) => {
    await openColumnChooser(page);
    await toggleColumnInChooser(page, 'Owner');
    await closeColumnChooser(page);

    const headers = await page.locator('thead th').allTextContents();
    expect(headers.join(' ')).not.toContain('Owner');
  });

  test('column chooser re-shows a hidden column', async ({ page }) => {
    await openColumnChooser(page);
    await toggleColumnInChooser(page, 'Owner');
    await closeColumnChooser(page);

    // Verify hidden
    let headers = await page.locator('thead th').allTextContents();
    expect(headers.join(' ')).not.toContain('Owner');

    // Re-show Owner
    await openColumnChooser(page);
    await toggleColumnInChooser(page, 'Owner');
    await closeColumnChooser(page);

    headers = await page.locator('thead th').allTextContents();
    expect(headers.join(' ')).toContain('Owner');
  });
});

test.describe('Cell selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('clicking a cell activates it with visual indicator', async ({ page }) => {
    const cellContent = getCellContent(page, 0, 0);
    await cellContent.click();
    // Active cell: tabindex=0 (React/Angular/Vue) or data-active-cell="true" (JS)
    await expectActiveCellAt(page, 0, 0);
  });

  test('arrow keys navigate between cells', async ({ page }) => {
    const cellContent = getCellContent(page, 0, 0);
    await cellContent.click();

    const region = getGridRegion(page);
    await region.press('ArrowRight');

    await expectActiveCellAt(page, 0, 1);
  });

  test('Tab navigates to next cell', async ({ page }) => {
    const cellContent = getCellContent(page, 0, 0);
    await cellContent.click();

    const region = getGridRegion(page);
    await region.press('Tab');

    await expectActiveCellAt(page, 0, 1);
  });
});

test.describe('Cell editing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('double-clicking an editable cell opens inline editor', async ({ page }) => {
    const input = await enterCellEdit(page, 0, 0);
    await expect(input).toBeVisible();
  });

  test('Enter commits the edited value', async ({ page }) => {
    const input = await enterCellEdit(page, 0, 0);

    await input.fill('!E2E Edited');
    await input.press('Enter');
    await expect.poll(async () => (await getCellContent(page, 0, 0).textContent()) ?? '').toContain('!E2E Edited');
  });

  test('Escape discards the edit', async ({ page }) => {
    const cellContent = getCellContent(page, 0, 0);
    const originalText = (await cellContent.textContent()) ?? '';

    const input = await enterCellEdit(page, 0, 0);

    await input.fill('Should Be Discarded');
    await input.press('Escape');
    await expect.poll(async () => ((await getCellContent(page, 0, 0).textContent()) ?? '').trim()).toBe(originalText.trim());
  });
});

test.describe('Keyboard navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('Enter opens cell editor on editable cell', async ({ page }) => {
    const cellContent = getCellContent(page, 0, 0);
    await cellContent.click();

    const region = getGridRegion(page);
    await region.press('Enter');

    const input = getOpenTextEditor(page);
    await expect(input).toBeVisible({ timeout: 3000 });
  });

  test('Escape closes editor without changing value', async ({ page }) => {
    const cellContent = getCellContent(page, 0, 0);
    const originalText = ((await cellContent.textContent()) ?? '').trim();
    await cellContent.click();

    const region = getGridRegion(page);
    await region.press('Enter');
    await region.press('Escape');
    await expect.poll(async () => ((await getCellContent(page, 0, 0).textContent()) ?? '').trim()).toBe(originalText);
    const editorInput = getOpenTextEditor(page);
    await expect(editorInput).toHaveCount(0);
  });

  test('Ctrl+A selects all cells', async ({ page }) => {
    const cellContent = getCellContent(page, 0, 0);
    await cellContent.click();

    const region = getGridRegion(page);
    await region.press('Control+a');
    await expect.poll(async () => page.locator('[data-in-range="true"]').count()).toBeGreaterThan(1);
  });

  test('Home/End navigate to first/last column', async ({ page }) => {
    const cellContent = getCellContent(page, 0, 2);
    await cellContent.click();

    const region = getGridRegion(page);

    await region.press('Home');
    await expectActiveCellAt(page, 0, 0);

    await region.press('End');
    await expectActiveCellAt(page, 0, DEMO_COLUMN_INDEX.active);
  });
});

test.describe('Sticky header', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('header stays visible after scrolling the grid', async ({ page }) => {
    await changePageSize(page, 50);

    const thead = page.locator('thead').first();

    await expect(thead).toBeVisible();

    await scrollGridVertically(page, 500);
    await expect(thead).toBeVisible();
    // Vue Vuetify/PrimeVue and React Material can keep the rendered header visible
    // while the raw thead box sits above the viewport. Skip the y-position check.
    if (!['react-material', 'vue-vuetify', 'vue-primevue'].includes(getFramework(page))) {
      const box = await thead.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.y).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

test.describe('Context menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('right-click opens context menu with Copy/Cut/Paste', async ({ page }) => {
    await rightClickCell(page, 0, 0);

    // Vue Vuetify uses role="list" (VList); React/Angular use role="menu"
    const menu = getContextMenu(page);
    await expect(menu).toBeVisible({ timeout: 3000 });

    const menuText = await menu.textContent();
    expect(menuText).toMatch(/copy/i);
    expect(menuText).toMatch(/cut/i);
    expect(menuText).toMatch(/paste/i);
  });

  test('context menu contains Select all option', async ({ page }) => {
    await rightClickCell(page, 0, 0);

    // Vue Vuetify uses role="list" (VList); React/Angular use role="menu"
    const menu = getContextMenu(page);
    await expect(menu).toBeVisible({ timeout: 3000 });

    // Vue Vuetify items are role="listitem"; React/Angular items are role="button"
    const selectAllItem = getContextMenuItem(page, /select all/i);
    await expect(selectAllItem).toBeVisible();
  });

  test('clicking outside dismisses context menu', async ({ page }) => {
    await rightClickCell(page, 0, 0);

    // Vue Vuetify uses role="list" (VList); React/Angular use role="menu"
    const menu = getContextMenu(page);
    await expect(menu).toBeVisible({ timeout: 3000 });

    // Click elsewhere to dismiss (framework-adaptive)
    await dismissContextMenu(page);

    await expect(menu).not.toBeVisible();
  });
});

test.describe('Undo/Redo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('Ctrl+Z undoes a cell edit', async ({ page }) => {
    const td = getDataCell(page, 0, 'name');
    const originalText = await td.textContent();

    const input = await enterCellEdit(page, 0, 0);
    await input.fill('!Undo Test Value');
    await input.press('Enter');

    // After Enter the active cell moves down, re-locate td[0,0]
    await expect.poll(async () => await td.textContent()).not.toBe(originalText);
    const currentEditedText = await td.textContent();
    expect(currentEditedText).not.toBe(originalText);

    const region = getGridRegion(page);
    // Click a different cell first to ensure the grid region has focus
    await getCellContent(page, 2, 0).click();
    await region.press('Control+z');
    await expect.poll(async () => ((await td.textContent()) ?? '').trim()).toBe((originalText ?? '').trim());
  });

  test('Ctrl+Y redoes after undo', async ({ page }) => {
    const td = getDataCell(page, 0, 'name');

    const input = await enterCellEdit(page, 0, 0);
    await input.fill('!Redo Test Value');
    await input.press('Enter');

    await expect.poll(async () => await td.textContent()).not.toBe('');
    const afterEdit = await td.textContent();

    const region = getGridRegion(page);
    await region.press('Control+z');
    await expect.poll(async () => ((await td.textContent()) ?? '').trim()).not.toBe((afterEdit ?? '').trim());

    await region.press('Control+y');
    await expect.poll(async () => ((await td.textContent()) ?? '').trim()).toBe((afterEdit ?? '').trim());
  });
});

test.describe('Advanced keyboard shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('F2 enters edit mode on active cell', async ({ page }) => {
    const cellContent = getCellContent(page, 0, 0);
    await cellContent.click();

    const region = getGridRegion(page);
    await region.press('F2');

    const input = getOpenTextEditor(page);
    await expect(input).toBeVisible({ timeout: 3000 });
  });

  test('Delete key clears editable cell value', async ({ page }) => {
    const cellContent = getCellContent(page, 0, 0);
    await cellContent.click();

    const region = getGridRegion(page);
    await region.press('Delete');

    const td = getDataCell(page, 0, 'name');
    await expect.poll(async () => ((await td.textContent()) ?? '').trim()).toBe('');
  });
});

test.describe('Range selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('Shift+Click selects a range of cells', async ({ page }) => {
    const cell00 = getCellContent(page, 0, 0);
    const cell22 = getCellContent(page, 2, 2);

    await cell00.click();

    await cell22.click({ modifiers: ['Shift'] });
    await expect.poll(async () => page.locator('[data-in-range="true"]').count()).toBe(9);
  });

  test('Shift+Click range has data-in-range="true" on all covered cells', async ({ page }) => {
    const cell00 = getCellContent(page, 0, 0);
    const cell10 = getCellContent(page, 1, 0);

    await cell00.click();

    await cell10.click({ modifiers: ['Shift'] });
    await expect.poll(async () => page.locator('[data-in-range="true"]').count()).toBe(2);
  });
});

test.describe('Selection seam regressions', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      ![
        'react-fluent',
        'react-material',
        'react-radix',
        'angular-radix',
        'angular-material',
        'angular-primeng',
        'vue-radix',
        'vue-vuetify',
        'vue-primevue',
        'js',
      ].includes(testInfo.project.name),
      'Seam regression coverage requires an example with cell references enabled.',
    );
    await page.goto('/?cellReferences=1');
    await waitForGrid(page);
  });

  test('dragging from the row-number seam does not select row-number text', async ({ page }) => {
    const activeCell = getCellContentByColumnId(page, 0, 'name');
    const startCell = page.locator('tbody tr:nth-child(1) td').first();
    const endCell = page.locator('tbody tr:nth-child(3) td').first();

    await activeCell.click();
    await page.evaluate(() => window.getSelection()?.removeAllRanges());

    const startBox = await startCell.boundingBox();
    const endBox = await endCell.boundingBox();
    if (!startBox || !endBox) {
      throw new Error('Expected row-number cells to have bounding boxes.');
    }

    const seamX = startBox.x + startBox.width - 1;
    await page.mouse.move(seamX, startBox.y + startBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(seamX, endBox.y + endBox.height / 2, { steps: 8 });
    await page.mouse.up();

    await expect.poll(async () => page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('');
    if (isJS(page)) {
      await expect(activeCell).toHaveAttribute('data-active-cell', 'true');
    } else {
      await expect(activeCell).toHaveAttribute('tabindex', '0');
    }
  });

  test('dragging from the column-letter seam does not select header text', async ({ page }) => {
    const activeCell = getCellContentByColumnId(page, 0, 'name');
    const startHeader = page.locator('thead tr').first().locator('th').nth(1);
    const endHeader = page.locator('thead tr').first().locator('th').nth(3);

    await activeCell.click();
    await page.evaluate(() => window.getSelection()?.removeAllRanges());

    const startBox = await startHeader.boundingBox();
    const endBox = await endHeader.boundingBox();
    if (!startBox || !endBox) {
      throw new Error('Expected column-letter header cells to have bounding boxes.');
    }

    const seamY = startBox.y + startBox.height - 1;
    await page.mouse.move(startBox.x + startBox.width / 2, seamY);
    await page.mouse.down();
    await page.mouse.move(endBox.x + endBox.width / 2, seamY, { steps: 8 });
    await page.mouse.up();

    await expect.poll(async () => page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('');
    if (isJS(page)) {
      await expect(activeCell).toHaveAttribute('data-active-cell', 'true');
    } else {
      await expect(activeCell).toHaveAttribute('tabindex', '0');
    }
  });
});

test.describe('Status bar aggregations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('selecting cells shows aggregation info in status bar', async ({ page }) => {
    const cellContent = getCellContent(page, 0, 0);
    await cellContent.click();

    const region = getGridRegion(page);
    await region.press('Control+a');
    await expect.poll(async () => (await getStatusBar(page).textContent()) ?? '').toMatch(/sum|avg|count|cells/i);
  });

  test('status bar shows cell count when cells selected', async ({ page }) => {
    const cell00 = getCellContent(page, 0, 0);
    const cell11 = getCellContent(page, 1, 1);

    await cell00.click();

    await cell11.click({ modifiers: ['Shift'] });
    await expect.poll(async () => (await getStatusBar(page).textContent()) ?? '').toMatch(/cells?.*4|4.*cells?/i);
  });
});

test.describe('Column header menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('column options menu has pin left/right and autosize buttons', async ({ page }) => {
    await openColumnOptions(page, 'Project Name');

    const fw = getFramework(page);
    if (fw === 'vue-vuetify') {
      // Vuetify column menu uses role="listitem" (VList items), not role="button"
      await expect(page.getByRole('listitem').filter({ hasText: 'Pin left' }).first()).toBeVisible();
      await expect(page.getByRole('listitem').filter({ hasText: 'Pin right' }).first()).toBeVisible();
      await expect(page.getByRole('listitem').filter({ hasText: 'Autosize this column' }).first()).toBeVisible();
      await expect(page.getByRole('listitem').filter({ hasText: 'Autosize all columns' }).first()).toBeVisible();
    } else if (fw === 'react-material' || fw === 'angular-material' || fw === 'angular-primeng' || fw === 'vue-radix' || fw === 'vue-primevue' || fw === 'js') {
      // React Material, Angular Material/PrimeNG, Vue Radix/PrimeVue, and JS use role="menuitem" for the popup actions.
      await expect(page.getByRole('menuitem', { name: 'Pin left' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Pin right' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Autosize this column' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Autosize all columns' })).toBeVisible();
    } else {
      await expect(page.getByRole('button', { name: 'Pin left' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Pin right' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Autosize this column' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Autosize all columns' })).toBeVisible();
    }
  });

  test('pin left makes column sticky', async ({ page }) => {
    const th = page.locator('thead th').filter({ hasText: 'Project Name' }).first();
    await openColumnOptions(page, 'Project Name');

    const fw = getFramework(page);
    if (fw === 'vue-vuetify') {
      // Vuetify column menu uses role="listitem" (VList items), not role="button"
      await page.getByRole('listitem').filter({ hasText: 'Pin left' }).first().click();
    } else if (fw === 'react-material' || fw === 'angular-material' || fw === 'angular-primeng' || fw === 'vue-radix' || fw === 'vue-primevue' || fw === 'js') {
      // React Material, Angular Material/PrimeNG, Vue Radix/PrimeVue, and JS use role="menuitem" for the popup actions.
      await page.getByRole('menuitem', { name: 'Pin left' }).click();
    } else {
      await page.getByRole('button', { name: 'Pin left' }).click();
    }

    await expect.poll(async () => await th.evaluate((el) => getComputedStyle(el).position)).toBe('sticky');
    const pinnedLeft = await th.evaluate((el) => getComputedStyle(el).left);
    expect(pinnedLeft).toMatch(/^-?\d+(\.\d+)?px$/);
    expect(Number.parseFloat(pinnedLeft)).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Column resize', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('dragging resize handle changes column width', async ({ page }) => {
    const th = page.locator('thead th').filter({ hasText: 'Project Name' }).first();
    const fw = getFramework(page);
    const getMeasuredWidth = async () => th.evaluate((el) => {
      const rectWidth = el.getBoundingClientRect().width;
      const style = (el as HTMLElement).style;
      const parsePx = (value: string) => Number.parseFloat(value || '0');
      return Math.max(
        rectWidth,
        parsePx(style.width),
        parsePx(style.minWidth),
        parsePx(style.maxWidth),
      );
    });
    const initialWidth = await getMeasuredWidth();

    // Hover the header first to make the resize handle visible (some frameworks
    // only show it on hover).
    await th.hover();

    const resizeHandle = getResizeHandle(page, 'Project Name');
    await expect(resizeHandle).toBeVisible({ timeout: 3000 });
    const handleBox = await resizeHandle.boundingBox();

    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;
    const endX = startX + 80;

    if (fw === 'angular-radix') {
      await resizeHandle.dispatchEvent('pointerdown', {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: startX,
        clientY: startY,
        isPrimary: true,
        pointerId: 1,
        pointerType: 'mouse',
      });
      await page.evaluate(({ endX, startY }) => {
        window.dispatchEvent(new PointerEvent('pointermove', {
          bubbles: true,
          button: 0,
          buttons: 1,
          clientX: endX,
          clientY: startY,
          isPrimary: true,
          pointerId: 1,
          pointerType: 'mouse',
        }));
        window.dispatchEvent(new PointerEvent('pointerup', {
          bubbles: true,
          button: 0,
          buttons: 0,
          clientX: endX,
          clientY: startY,
          isPrimary: true,
          pointerId: 1,
          pointerType: 'mouse',
        }));
      }, { endX, startY });
    } else {
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(endX, startY, { steps: 10 });
      await page.mouse.up();
    }

    await expect.poll(getMeasuredWidth).toBeGreaterThan(initialWidth);
  });
});

test.describe('Clipboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('Ctrl+C shows marching ants overlay on selected cells', async ({ page }) => {
    const cell = getCellContent(page, 0, 0);
    await cell.click();

    const region = getGridRegion(page);
    await region.press('Control+c');

    // Marching ants SVG appears as an absolutely-positioned overlay
    const svg = page.locator('svg').first();
    await expect.poll(async () => await svg.count()).toBeGreaterThan(0);
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width ?? 0).toBeGreaterThan(0);
    expect(box?.height ?? 0).toBeGreaterThan(0);
  });

  test('Ctrl+V pastes copied value into another cell', async ({ page }) => {
    // Edit cell [0,0] to a known value
    const input = await enterCellEdit(page, 0, 0);
    await input.fill('!Clipboard Value');
    await input.press('Enter');
    await expect.poll(async () => (await getDataCell(page, 0, 'name').textContent()) ?? '').toContain('!Clipboard Value');

    // Re-click cell [0,0] to select it
    const cell00 = getCellContent(page, 0, 0);
    await cell00.click();

    // Copy it
    const region = getGridRegion(page);
    await region.press('Control+c');

    // Navigate to cell [1,0] and paste
    const cell10 = getCellContent(page, 1, 0);
    await cell10.click();
    await region.press('Control+v');
    await expect.poll(async () => (await getDataCell(page, 1, 'name').textContent()) ?? '').toContain('!Clipboard Value');
  });
});

test.describe('Fill handle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('fill handle is visible on active cell', async ({ page }) => {
    const cell = getCellContent(page, 0, 0);
    await cell.click();
    await expect(getFillHandle(page)).toBeVisible();
  });

  test('dragging fill handle fills value into rows below', async ({ page }) => {
    // Edit cell [0,0] to a known value
    const cell = getCellContent(page, 0, 0);
    const input = await enterCellEdit(page, 0, 0);
    await input.fill('!Fill Source');
    await input.press('Enter');
    await expect.poll(async () => (await getDataCell(page, 0, 'name').textContent()) ?? '').toContain('!Fill Source');

    // Re-activate cell [0,0]
    await cell.click();
    await expect(getFillHandle(page)).toBeVisible();

    const handleBox = await getFillHandle(page).boundingBox();
    const row3 = getDataCell(page, 2, 'name');
    const row3Box = await row3.boundingBox();

    const hx = handleBox?.x ?? 0, hw = handleBox?.width ?? 0, hy = handleBox?.y ?? 0, hh = handleBox?.height ?? 0;
    const r3y = row3Box?.y ?? 0, r3h = row3Box?.height ?? 0;
    await page.mouse.move(hx + hw / 2, hy + hh / 2);
    await page.mouse.down();
    await page.mouse.move(hx + hw / 2, r3y + r3h / 2, { steps: 10 });
    await page.mouse.up();
    await expect.poll(async () => (await getDataCell(page, 1, 'name').textContent()) ?? '').toContain('!Fill Source');
    await expect.poll(async () => (await getDataCell(page, 2, 'name').textContent()) ?? '').toContain('!Fill Source');
  });

  // Cross-column fill compatibility (areFillCompatible) tests
  //
  // Column layout: 0:name (text, editable), 1:status (richSelect, editable),
  // 2:owner (not editable), 3:department (not editable), 4:budget (not editable),
  // 5:startDate (date, editable), 6:active (boolean, editable)
  //
  // areFillCompatible blocks fills when column types or custom editors differ.

  test('fill handle from text cell to richSelect (status) column does nothing', async ({ page }) => {
    // name (col 0) has no custom editor; status (col 1) uses richSelect.
    // Different editors = incompatible, so fill should be blocked.
    const statusCell = page.locator('tbody tr:nth-child(1) td[data-column-id="status"]');
    const originalStatus = await statusCell.textContent();

    const nameCell = getCellContent(page, 0, 0);
    await nameCell.click();
    await expect(getFillHandle(page)).toBeVisible();

    const handleBox = await getFillHandle(page).boundingBox();
    const statusBox = await statusCell.boundingBox();
    expect(handleBox).not.toBeNull();
    expect(statusBox).not.toBeNull();
    if (!handleBox || !statusBox) {
      throw new Error('Expected fill handle and target status cell to have bounding boxes.');
    }

    const hx = handleBox.x + handleBox.width / 2;
    const hy = handleBox.y + handleBox.height / 2;
    const sx = statusBox.x + statusBox.width / 2;
    const sy = statusBox.y + statusBox.height / 2;

    await page.mouse.move(hx, hy);
    await page.mouse.down();
    await page.mouse.move(sx, sy, { steps: 10 });
    await page.mouse.up();

    const afterStatus = await statusCell.textContent();
    expect(afterStatus).toBe(originalStatus);
  });

  test('fill handle from date cell to boolean (active) column does nothing', async ({ page }) => {
    // startDate is type:'date', active is type:'boolean'. Different types = blocked.
    const activeCell = page.locator('tbody tr:nth-child(1) td[data-column-id="active"]');
    const originalActive = await activeCell.textContent();

    await activateCell(page, 0, DEMO_COLUMN_INDEX.startDate);
    await expect(getFillHandle(page)).toBeVisible();

    const handleBox = await getFillHandle(page).boundingBox();
    const activeBox = await activeCell.boundingBox();
    expect(handleBox).not.toBeNull();
    expect(activeBox).not.toBeNull();
    if (!handleBox || !activeBox) {
      throw new Error('Expected fill handle and target active cell to have bounding boxes.');
    }

    const hx = handleBox.x + handleBox.width / 2;
    const hy = handleBox.y + handleBox.height / 2;
    const ax = activeBox.x + activeBox.width / 2;
    const ay = activeBox.y + activeBox.height / 2;

    await page.mouse.move(hx, hy);
    await page.mouse.down();
    await page.mouse.move(ax, ay, { steps: 10 });
    await page.mouse.up();

    const afterActive = await activeCell.textContent();
    expect(afterActive).toBe(originalActive);
  });

  test('fill handle from text cell across all columns leaves date and boolean unchanged', async ({ page }) => {
    // Dragging name (text, col 0) all the way to active (boolean, last col).
    // Non-editable columns are skipped by isColumnEditable. startDate (date)
    // and active (boolean) are type-incompatible with name (text). Nothing changes.
    const dateCellTd = page.locator('tbody tr:nth-child(1) td[data-column-id="startDate"]');
    const activeCellTd = page.locator('tbody tr:nth-child(1) td[data-column-id="active"]');
    const originalDate = await dateCellTd.textContent();
    const originalActive = await activeCellTd.textContent();

    const nameCell = getCellContent(page, 0, 0);
    await nameCell.click();
    await expect(getFillHandle(page)).toBeVisible();

    const handleBox = await getFillHandle(page).boundingBox();
    const activeBox = await activeCellTd.boundingBox();
    expect(handleBox).not.toBeNull();
    expect(activeBox).not.toBeNull();
    if (!handleBox || !activeBox) {
      throw new Error('Expected fill handle and target active cell to have bounding boxes.');
    }

    const hx = handleBox.x + handleBox.width / 2;
    const hy = handleBox.y + handleBox.height / 2;
    const ax = activeBox.x + activeBox.width / 2;
    const ay = activeBox.y + activeBox.height / 2;

    await page.mouse.move(hx, hy);
    await page.mouse.down();
    await page.mouse.move(ax, ay, { steps: 15 });
    await page.mouse.up();

    const afterDate = await dateCellTd.textContent();
    const afterActive = await activeCellTd.textContent();
    expect(afterDate).toBe(originalDate);
    expect(afterActive).toBe(originalActive);
  });
});

test.describe('Date editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('double-clicking a date cell opens a date input', async ({ page }) => {
    const dateInput = await enterDateCellEdit(page, 0, DEMO_COLUMN_INDEX.startDate);
    await expect(dateInput).toBeVisible({ timeout: 3000 });
  });
});

test.describe('RichSelect editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('double-clicking a Status cell opens a dropdown with search', async ({ page }) => {
    const statusCell = getCellContent(page, 0, 1);
    await statusCell.click();
    if (isJS(page)) {
      await getGridRegion(page).press('Enter');
    } else {
      await statusCell.dblclick();
    }

    // RichSelect shows a listbox with options and a search input
    const searchInput = page.locator('input[placeholder="Search..."]').first();
    await expect(searchInput).toBeVisible({ timeout: 3000 });

    const options = page.locator('[role="option"]');
    const count = await options.count();
    expect(count).toBeGreaterThan(0);
  });

  test('typing in RichSelect search filters options', async ({ page }) => {
    const statusCell = getCellContent(page, 0, 1);
    await statusCell.click();
    if (isJS(page)) {
      await getGridRegion(page).press('Enter');
    } else {
      await statusCell.dblclick();
    }

    const searchInput = page.locator('input[placeholder="Search..."]').first();
    await expect(searchInput).toBeVisible({ timeout: 3000 });

    const allOptionsBefore = await page.locator('[role="option"]').count();

    await searchInput.fill('Act');
    await expect.poll(async () => page.locator('[role="option"]').count()).toBeLessThan(allOptionsBefore);
  });
});

test.describe('Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('filter then sort then paginate works together', async ({ page }) => {
    // 1. Apply text filter
    await openFilter(page, 'Project Name');
    await getTextFilterInput(page).fill('Project');
    await applyFilter(page);

    let names = await getColumnTexts(page, 'name');
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) {
      expect(n.toLowerCase()).toContain('project');
    }

    // 2. Sort descending
    await sortColumn(page, 'Project Name', 'descending');

    // 3. Names should still contain "Project"
    names = await getColumnTexts(page, 'name');
    for (const n of names) {
      expect(n.toLowerCase()).toContain('project');
    }
  });

  test('column hide persists through pagination', async ({ page }) => {
    await openColumnChooser(page);
    await toggleColumnInChooser(page, 'Owner');
    await closeColumnChooser(page);

    await clickNextPage(page);

    const headers = await page.locator('thead th').allTextContents();
    expect(headers.join(' ')).not.toContain('Owner');
  });

  test('edit value persists after pagination round-trip', async ({ page }) => {
    const input = await enterCellEdit(page, 0, 0);
    await input.fill('!Persisted Value');
    await input.press('Enter');
    await expect.poll(async () => (await getCellContent(page, 0, 0).textContent()) ?? '').toContain('!Persisted Value');

    await clickNextPage(page);
    await clickPrevPage(page);

    const text = await getCellContent(page, 0, 0).textContent();
    expect(text).toContain('!Persisted Value');
  });
});
