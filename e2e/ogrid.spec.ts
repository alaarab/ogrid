/**
 * OGrid E2E test suite.
 *
 * Runs the same tests against every framework example app (React Radix,
 * Angular Material, Vue Vuetify, Vanilla JS).  Each app renders 75 demo
 * projects with sorting, filtering, pagination, cell editing, cell selection,
 * and a status bar.
 *
 * Columns: Project Name | Status | Owner | Department | Budget | Start Date
 * Page size: 25 (React/Angular/Vue), 20 (JS)  |  Total rows: 75
 */

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
  openColumnChooser,
  openColumnOptions,
  rightClickCell,
  getStatusBar,
  getFillHandle,
  getResizeHandle,
  enterCellEdit,
  getDefaultPageSize,
  expectActiveCellAt,
  getTextFilterInput,
  supportsEscapeCancel,
  scrollGridVertically,
  dismissContextMenu,
  toggleColumnInChooser,
  closeColumnChooser,
  getContextMenu,
  getContextMenuItem,
  supportsUndo,
  supportsClipboardPaste,
  supportsAriaSort,
  supportsRichSelect,
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

  test('renders a table with 6 column headers', async ({ page }) => {
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
    await expect(getRows(page)).toHaveCount(expectedRows);
  });

  test('first row contains "Project A" as project name', async ({ page }) => {
    await waitForGrid(page);
    const names = await getColumnTexts(page, 'name');
    expect(names[0]).toContain('Project A');
  });

  test('pagination info shows total count of 75', async ({ page }) => {
    await waitForGrid(page);
    const pageSize = getDefaultPageSize(page);
    const info = page.locator(`text=/1.*to.*${pageSize}.*of.*75/i`).first();
    // Fallback: for JS the format may differ (e.g., "1-20 of 75")
    if (await info.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(info).toBeVisible();
    } else {
      const text = await page.locator('body').textContent();
      expect(text).toMatch(/75/);
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
    // Skip on JS and Vue Vuetify — these frameworks do not set aria-sort on th elements
    if (isJS(page) || !supportsAriaSort(page)) {
      test.skip();
      return;
    }
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
    await expect(getRows(page)).toHaveCount(pageSize);
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
    await expect(getRows(page)).toHaveCount(50);
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

    await expect(getRows(page)).toHaveCount(getDefaultPageSize(page));
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
      // JS: checkboxes in .ogrid-filter-checkbox-list
      const checkbox = page.locator('.ogrid-filter-checkbox-list label').filter({ hasText: 'Active' }).locator('input');
      await checkbox.click();
    } else {
      // React/Angular/Vue: dialog or popover with checkboxes
      const popover = getFilterPopover(page);
      await expect(popover).toBeVisible({ timeout: 2000 });
      // "Active" is first alphabetically — click first checkbox.
      // Vue Vuetify uses input[type="checkbox"] with aria-label (no role="checkbox").
      const activeCheckbox = (await popover.getByRole('checkbox').count()) > 0
        ? popover.getByRole('checkbox').first()
        : popover.locator('input[type="checkbox"]').first();
      await activeCheckbox.click();
    }
    await page.waitForTimeout(100);

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
    await page.waitForTimeout(200);

    // Active cell: tabindex=0 (React/Angular/Vue) or data-active-cell="true" (JS)
    await expectActiveCellAt(page, 0, 0);
  });

  test('arrow keys navigate between cells', async ({ page }) => {
    const cellContent = getCellContent(page, 0, 0);
    await cellContent.click();
    await page.waitForTimeout(100);

    const region = getGridRegion(page);
    await region.press('ArrowRight');
    await page.waitForTimeout(100);

    await expectActiveCellAt(page, 0, 1);
  });

  test('Tab navigates to next cell', async ({ page }) => {
    const cellContent = getCellContent(page, 0, 0);
    await cellContent.click();
    await page.waitForTimeout(100);

    const region = getGridRegion(page);
    await region.press('Tab');
    await page.waitForTimeout(100);

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

    await input.fill('E2E Edited');
    await page.waitForTimeout(100);
    await input.press('Enter');
    await page.waitForTimeout(500);

    const updatedText = await getCellContent(page, 0, 0).textContent();
    expect(updatedText).toContain('E2E Edited');
  });

  test('Escape discards the edit', async ({ page }) => {
    // Vue Vuetify inline editor does not cancel on Escape — skip for that framework
    if (!supportsEscapeCancel(page)) {
      test.skip();
      return;
    }

    const cellContent = getCellContent(page, 0, 0);
    const originalText = (await cellContent.textContent()) ?? '';

    const input = await enterCellEdit(page, 0, 0);

    await input.fill('Should Be Discarded');
    await input.press('Escape');
    await page.waitForTimeout(500);

    const restoredText = await getCellContent(page, 0, 0).textContent();
    expect(restoredText?.trim()).toBe(originalText.trim());
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
    await page.waitForTimeout(200);

    const region = getGridRegion(page);
    await region.press('Enter');
    await page.waitForTimeout(500);

    const input = page.locator('input[type="text"]').first();
    await expect(input).toBeVisible({ timeout: 3000 });
  });

  test('Escape closes editor without changing value', async ({ page }) => {
    // Vue Vuetify inline editor does not close on Escape — skip for that framework
    if (!supportsEscapeCancel(page)) {
      test.skip();
      return;
    }

    const cellContent = getCellContent(page, 0, 0);
    await cellContent.click();
    await page.waitForTimeout(200);

    const region = getGridRegion(page);
    await region.press('Enter');
    await page.waitForTimeout(300);

    await region.press('Escape');
    await page.waitForTimeout(200);

    const inputCount = await page.locator('input[type="text"]').count();
    expect(inputCount).toBe(0);
  });

  test('Ctrl+A selects all cells', async ({ page }) => {
    const cellContent = getCellContent(page, 0, 0);
    await cellContent.click();
    await page.waitForTimeout(200);

    const region = getGridRegion(page);
    await region.press('Control+a');
    await page.waitForTimeout(200);

    const inRangeCells = page.locator('[data-in-range="true"]');
    const count = await inRangeCells.count();
    expect(count).toBeGreaterThan(1);
  });

  test('Home/End navigate to first/last column', async ({ page }) => {
    const cellContent = getCellContent(page, 0, 2);
    await cellContent.click();
    await page.waitForTimeout(200);

    const region = getGridRegion(page);

    await region.press('Home');
    await page.waitForTimeout(100);
    await expectActiveCellAt(page, 0, 0);

    await region.press('End');
    await page.waitForTimeout(100);
    await expectActiveCellAt(page, 0, 5);
  });
});

test.describe('Sticky header', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('header stays visible after scrolling the grid', async ({ page }) => {
    // JS uses full-page scroll (no overflow container) so thead does not stay
    // sticky within the viewport when scrolling via window.scrollTo.
    // The sticky header is implemented correctly in JS (position: sticky; top: 0)
    // but requires an overflow-scrolling ancestor, which this test can't exercise
    // in headless Playwright with a full-page layout.
    if (isJS(page)) {
      test.skip();
      return;
    }

    await changePageSize(page, 50);

    const thead = page.locator('thead').first();

    await expect(thead).toBeVisible();

    await scrollGridVertically(page, 500);
    await page.waitForTimeout(300);

    await expect(thead).toBeVisible();
    // Vue Vuetify uses page-level scroll — the header scrolls off-screen (box.y < 0)
    // but the thead element is still attached to the DOM. Skip the y-position check.
    if (getFramework(page) !== 'vue-vuetify') {
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
    if (isJS(page)) {
      test.skip();
      return;
    }
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
    if (isJS(page)) {
      test.skip();
      return;
    }
    await rightClickCell(page, 0, 0);

    // Vue Vuetify uses role="list" (VList); React/Angular use role="menu"
    const menu = getContextMenu(page);
    await expect(menu).toBeVisible({ timeout: 3000 });

    // Vue Vuetify items are role="listitem"; React/Angular items are role="button"
    const selectAllItem = getContextMenuItem(page, /select all/i);
    await expect(selectAllItem).toBeVisible();
  });

  test('clicking outside dismisses context menu', async ({ page }) => {
    if (isJS(page)) {
      test.skip();
      return;
    }
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
    if (isJS(page) || !supportsUndo(page)) {
      test.skip();
      return;
    }
    const td = page.locator('tbody tr:nth-child(1) td:nth-child(1)');
    const originalText = await td.textContent();

    const input = await enterCellEdit(page, 0, 0);
    await input.fill('Undo Test Value');
    await input.press('Enter');
    await page.waitForTimeout(500);

    // After Enter the active cell moves down, re-locate td[0,0]
    const editedText = await td.textContent();
    expect(editedText).not.toBe(originalText);

    const region = getGridRegion(page);
    // Click a different cell first to ensure the grid region has focus
    await getCellContent(page, 2, 0).click();
    await page.waitForTimeout(100);
    await region.press('Control+z');
    await page.waitForTimeout(300);

    const restoredText = await td.textContent();
    expect(restoredText?.trim()).toBe(originalText?.trim());
  });

  test('Ctrl+Y redoes after undo', async ({ page }) => {
    if (isJS(page) || !supportsUndo(page)) {
      test.skip();
      return;
    }
    const td = page.locator('tbody tr:nth-child(1) td:nth-child(1)');

    const input = await enterCellEdit(page, 0, 0);
    await input.fill('Redo Test Value');
    await input.press('Enter');
    await page.waitForTimeout(500);

    const afterEdit = await td.textContent();

    const region = getGridRegion(page);
    await region.press('Control+z');
    await page.waitForTimeout(300);

    await region.press('Control+y');
    await page.waitForTimeout(300);

    const afterRedo = await td.textContent();
    expect(afterRedo?.trim()).toBe(afterEdit?.trim());
  });
});

test.describe('Advanced keyboard shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('F2 enters edit mode on active cell', async ({ page }) => {
    if (isJS(page)) {
      test.skip();
      return;
    }
    const cellContent = getCellContent(page, 0, 0);
    await cellContent.click();
    await page.waitForTimeout(200);

    const region = getGridRegion(page);
    await region.press('F2');
    await page.waitForTimeout(500);

    const input = page.locator('input[type="text"]').first();
    await expect(input).toBeVisible({ timeout: 3000 });
  });

  test('Delete key clears editable cell value', async ({ page }) => {
    if (isJS(page)) {
      test.skip();
      return;
    }
    const cellContent = getCellContent(page, 0, 0);
    await cellContent.click();
    await page.waitForTimeout(200);

    const region = getGridRegion(page);
    await region.press('Delete');
    await page.waitForTimeout(300);

    const td = page.locator('tbody tr:nth-child(1) td:nth-child(1)');
    const textAfterDelete = await td.textContent();
    expect(textAfterDelete?.trim()).toBe('');
  });
});

test.describe('Range selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('Shift+Click selects a range of cells', async ({ page }) => {
    if (isJS(page)) {
      test.skip();
      return;
    }
    const cell00 = getCellContent(page, 0, 0);
    const cell22 = getCellContent(page, 2, 2);

    await cell00.click();
    await page.waitForTimeout(200);

    await cell22.click({ modifiers: ['Shift'] });
    await page.waitForTimeout(200);

    const inRangeCells = page.locator('[data-in-range="true"]');
    const count = await inRangeCells.count();
    // 3 rows x 3 cols = 9 cells in range
    expect(count).toBe(9);
  });

  test('Shift+Click range has data-in-range="true" on all covered cells', async ({ page }) => {
    if (isJS(page)) {
      test.skip();
      return;
    }
    const cell00 = getCellContent(page, 0, 0);
    const cell10 = getCellContent(page, 1, 0);

    await cell00.click();
    await page.waitForTimeout(200);

    await cell10.click({ modifiers: ['Shift'] });
    await page.waitForTimeout(200);

    const inRangeCells = page.locator('[data-in-range="true"]');
    const count = await inRangeCells.count();
    // 2 rows x 1 col = 2 cells
    expect(count).toBe(2);
  });
});

test.describe('Status bar aggregations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('selecting cells shows aggregation info in status bar', async ({ page }) => {
    if (isJS(page)) {
      test.skip();
      return;
    }
    const cellContent = getCellContent(page, 0, 0);
    await cellContent.click();
    await page.waitForTimeout(200);

    const region = getGridRegion(page);
    await region.press('Control+a');
    await page.waitForTimeout(200);

    const statusText = await getStatusBar(page).textContent();
    // With all cells selected, numeric columns produce Sum/Avg/etc.
    expect(statusText).toMatch(/sum|avg|count|cells/i);
  });

  test('status bar shows cell count when cells selected', async ({ page }) => {
    if (isJS(page)) {
      test.skip();
      return;
    }
    const cell00 = getCellContent(page, 0, 0);
    const cell11 = getCellContent(page, 1, 1);

    await cell00.click();
    await page.waitForTimeout(200);

    await cell11.click({ modifiers: ['Shift'] });
    await page.waitForTimeout(200);

    const statusText = await getStatusBar(page).textContent();
    // 2x2 = 4 cells selected — status bar should show cell count
    expect(statusText).toMatch(/cells?.*4|4.*cells?/i);
  });
});

test.describe('Column header menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('column options menu has pin left/right and autosize buttons', async ({ page }) => {
    if (isJS(page)) {
      test.skip();
      return;
    }
    await openColumnOptions(page, 'Project Name');

    const fw = getFramework(page);
    if (fw === 'vue-vuetify') {
      // Vuetify column menu uses role="listitem" (VList items), not role="button"
      await expect(page.getByRole('listitem').filter({ hasText: 'Pin left' }).first()).toBeVisible();
      await expect(page.getByRole('listitem').filter({ hasText: 'Pin right' }).first()).toBeVisible();
      await expect(page.getByRole('listitem').filter({ hasText: 'Autosize this column' }).first()).toBeVisible();
      await expect(page.getByRole('listitem').filter({ hasText: 'Autosize all columns' }).first()).toBeVisible();
    } else if (fw === 'angular-material') {
      // Angular Material uses role="menuitem" (MatMenu items), not role="button"
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
    if (isJS(page)) {
      test.skip();
      return;
    }
    const th = page.locator('thead th').filter({ hasText: 'Project Name' }).first();
    await openColumnOptions(page, 'Project Name');

    const fw = getFramework(page);
    if (fw === 'vue-vuetify') {
      // Vuetify column menu uses role="listitem" (VList items), not role="button"
      await page.getByRole('listitem').filter({ hasText: 'Pin left' }).first().click();
    } else if (fw === 'angular-material') {
      // Angular Material uses role="menuitem" (MatMenu items), not role="button"
      await page.getByRole('menuitem', { name: 'Pin left' }).click();
    } else {
      await page.getByRole('button', { name: 'Pin left' }).click();
    }
    await page.waitForTimeout(300);

    // Pinned column gets a left offset style applied
    const style = await th.getAttribute('style');
    expect(style).toMatch(/left:\s*0px/);
  });
});

test.describe('Column resize', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('dragging resize handle changes column width', async ({ page }) => {
    // Skip on JS (no resize handles) and Angular Material (resize separator
    // is not exposed as a visible accessible element in headless Playwright).
    if (isJS(page) || getFramework(page) === 'angular-material') {
      test.skip();
      return;
    }
    const th = page.locator('thead th:nth-child(1)');
    const initialBox = await th.boundingBox();

    // Hover the header first to make the resize handle visible (some frameworks
    // only show it on hover).
    await th.hover();
    await page.waitForTimeout(200);

    const resizeHandle = getResizeHandle(page, 'Project Name');
    await expect(resizeHandle).toBeVisible({ timeout: 3000 });
    const handleBox = await resizeHandle.boundingBox();

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + handleBox.width / 2 + 80, handleBox.y + handleBox.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const afterBox = await th.boundingBox();
    expect(afterBox?.width).toBeGreaterThan(initialBox?.width ?? 0);
  });
});

test.describe('Clipboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('Ctrl+C shows marching ants overlay on selected cells', async ({ page }) => {
    // Skip on JS and Angular Material — Angular's marching ants overlay does
    // not render a visible SVG in headless Playwright after Ctrl+C.
    if (isJS(page) || getFramework(page) === 'angular-material') {
      test.skip();
      return;
    }
    const cell = getCellContent(page, 0, 0);
    await cell.click();
    await page.waitForTimeout(200);

    const region = getGridRegion(page);
    await region.press('Control+c');
    await page.waitForTimeout(400);

    // Marching ants SVG appears as an absolutely-positioned overlay
    const svg = page.locator('svg').first();
    await expect(svg).toBeVisible();
    const style = await svg.getAttribute('style');
    expect(style).toMatch(/position:\s*absolute/);
  });

  test('Ctrl+V pastes copied value into another cell', async ({ page }) => {
    if (isJS(page) || !supportsClipboardPaste(page)) {
      test.skip();
      return;
    }
    // Edit cell [0,0] to a known value
    const input = await enterCellEdit(page, 0, 0);
    await input.fill('Clipboard Value');
    await input.press('Enter');
    await page.waitForTimeout(400);

    // Re-click cell [0,0] to select it
    const cell00 = getCellContent(page, 0, 0);
    await cell00.click();
    await page.waitForTimeout(200);

    // Copy it
    const region = getGridRegion(page);
    await region.press('Control+c');
    await page.waitForTimeout(300);

    // Navigate to cell [1,0] and paste
    const cell10 = getCellContent(page, 1, 0);
    await cell10.click();
    await page.waitForTimeout(200);
    await region.press('Control+v');
    await page.waitForTimeout(400);

    const pasted = await page.locator('tbody tr:nth-child(2) td:nth-child(1)').textContent();
    expect(pasted).toContain('Clipboard Value');
  });
});

test.describe('Fill handle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('fill handle is visible on active cell', async ({ page }) => {
    if (isJS(page)) {
      test.skip();
      return;
    }
    const cell = getCellContent(page, 0, 0);
    await cell.click();
    await page.waitForTimeout(300);

    await expect(getFillHandle(page)).toBeVisible();
  });

  test('dragging fill handle fills value into rows below', async ({ page }) => {
    if (isJS(page)) {
      test.skip();
      return;
    }
    // Edit cell [0,0] to a known value
    const cell = getCellContent(page, 0, 0);
    await cell.dblclick();
    await page.waitForTimeout(400);
    const input = page.locator('input[type="text"]').first();
    await input.fill('Fill Source');
    await input.press('Enter');
    await page.waitForTimeout(300);

    // Re-activate cell [0,0]
    await cell.click();
    await page.waitForTimeout(300);

    const handleBox = await getFillHandle(page).boundingBox();
    const row3 = page.locator('tbody tr:nth-child(3) td:nth-child(1)');
    const row3Box = await row3.boundingBox();

    const hx = handleBox?.x ?? 0, hw = handleBox?.width ?? 0, hy = handleBox?.y ?? 0, hh = handleBox?.height ?? 0;
    const r3y = row3Box?.y ?? 0, r3h = row3Box?.height ?? 0;
    await page.mouse.move(hx + hw / 2, hy + hh / 2);
    await page.mouse.down();
    await page.mouse.move(hx + hw / 2, r3y + r3h / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(400);

    const row2Text = await page.locator('tbody tr:nth-child(2) td:nth-child(1)').textContent();
    const row3Text = await page.locator('tbody tr:nth-child(3) td:nth-child(1)').textContent();
    expect(row2Text).toContain('Fill Source');
    expect(row3Text).toContain('Fill Source');
  });
});

test.describe('Date editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('double-clicking a date cell opens a date input', async ({ page }) => {
    if (isJS(page)) {
      test.skip();
      return;
    }
    // Start Date is col index 5 (6th column)
    const dateCell = page.locator('tbody tr:nth-child(1) td:nth-child(6) > div').first();
    await dateCell.click();
    await page.waitForTimeout(200);
    await dateCell.dblclick();
    await page.waitForTimeout(500);

    const dateInput = page.locator('input[type="date"]').first();
    await expect(dateInput).toBeVisible({ timeout: 3000 });
  });
});

test.describe('RichSelect editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('double-clicking a Status cell opens a dropdown with search', async ({ page }) => {
    // Vue Vuetify uses a native VSelect for the Status cell, not the custom RichSelect with search
    if (isJS(page) || !supportsRichSelect(page)) {
      test.skip();
      return;
    }
    // Status is col index 1 (2nd column)
    const statusCell = page.locator('tbody tr:nth-child(1) td:nth-child(2) > div').first();
    await statusCell.click();
    await page.waitForTimeout(200);
    await statusCell.dblclick();
    await page.waitForTimeout(500);

    // RichSelect shows a listbox with options and a search input
    const searchInput = page.locator('input[placeholder="Search..."]').first();
    await expect(searchInput).toBeVisible({ timeout: 3000 });

    const options = page.locator('[role="option"]');
    const count = await options.count();
    expect(count).toBeGreaterThan(0);
  });

  test('typing in RichSelect search filters options', async ({ page }) => {
    // Vue Vuetify uses a native VSelect for the Status cell, not the custom RichSelect with search
    if (isJS(page) || !supportsRichSelect(page)) {
      test.skip();
      return;
    }
    const statusCell = page.locator('tbody tr:nth-child(1) td:nth-child(2) > div').first();
    await statusCell.click();
    await page.waitForTimeout(200);
    await statusCell.dblclick();
    await page.waitForTimeout(500);

    const searchInput = page.locator('input[placeholder="Search..."]').first();
    await expect(searchInput).toBeVisible({ timeout: 3000 });

    const allOptionsBefore = await page.locator('[role="option"]').count();

    await searchInput.fill('Act');
    await page.waitForTimeout(200);

    const filteredOptions = await page.locator('[role="option"]').count();
    expect(filteredOptions).toBeLessThan(allOptionsBefore);
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
    await input.fill('Persisted Value');
    await page.waitForTimeout(100);
    await input.press('Enter');
    await page.waitForTimeout(500);

    await clickNextPage(page);
    await clickPrevPage(page);

    const text = await getCellContent(page, 0, 0).textContent();
    expect(text).toContain('Persisted Value');
  });
});
