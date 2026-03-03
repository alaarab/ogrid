/**
 * Framework-adaptive Playwright helpers for OGrid E2E tests.
 *
 * These helpers detect the framework from the page URL (port) and use
 * the correct selectors for each framework family:
 *   - React Radix    (port 3003)
 *   - Angular Material (port 3011)
 *   - Vue Vuetify     (port 3021)
 *   - Vanilla JS      (port 3030)
 */

import { expect, type Page, type Locator } from '@playwright/test';

// ---------------------------------------------------------------------------
// Framework detection
// ---------------------------------------------------------------------------

export type Framework = 'react-radix' | 'angular-material' | 'vue-vuetify' | 'js';

export function getFramework(page: Page): Framework {
  const url = page.url();
  if (url.includes(':3003')) return 'react-radix';
  if (url.includes(':3011')) return 'angular-material';
  if (url.includes(':3021')) return 'vue-vuetify';
  if (url.includes(':3030')) return 'js';
  // Fallback: try page title
  return 'react-radix';
}

export function isJS(page: Page): boolean {
  return getFramework(page) === 'js';
}

// ---------------------------------------------------------------------------
// Grid primitives
// ---------------------------------------------------------------------------

/** Wait for the grid table to be visible. */
export async function waitForGrid(page: Page): Promise<Locator> {
  const table = page.locator('table').first();
  await expect(table).toBeVisible({ timeout: 15_000 });
  return table;
}

/** Return all visible tbody data rows. */
export function getRows(page: Page): Locator {
  return page.locator('tbody tr');
}

/** Get text content of cells in a given column. */
export async function getColumnTexts(page: Page, columnId: string): Promise<string[]> {
  // Try data-column-id attribute (React/Angular)
  const cells = page.locator(`tbody td[data-column-id="${columnId}"]`);
  if ((await cells.count()) > 0) {
    return cells.allTextContents();
  }
  // Fallback: find column index by header text, then use nth-child
  const colNames: Record<string, string> = {
    name: 'Project Name', status: 'Status', owner: 'Owner',
    department: 'Department', budget: 'Budget', startDate: 'Start Date',
  };
  const target = colNames[columnId] ?? columnId;
  const headers = await page.locator('thead th').allTextContents();
  const idx = headers.findIndex((h) => h.includes(target));
  if (idx === -1) throw new Error(`Column "${columnId}" not found in headers: ${headers.join(', ')}`);
  return page.locator(`tbody tr td:nth-child(${idx + 1})`).allTextContents();
}

// ---------------------------------------------------------------------------
// Cell interaction
// ---------------------------------------------------------------------------

/**
 * Get the interactive content element of a cell.
 * React/Angular/Vue: td > div (the inner cellContent div with event handlers)
 * JS: td directly (cells have handlers on the td)
 */
export function getCellContent(page: Page, rowIdx: number, colIdx: number): Locator {
  if (isJS(page)) {
    return page.locator(`tbody tr:nth-child(${rowIdx + 1}) td:nth-child(${colIdx + 1})`).first();
  }
  return page.locator(`tbody tr:nth-child(${rowIdx + 1}) td:nth-child(${colIdx + 1}) > div`).first();
}

/** Get the grid region/wrapper for keyboard events. */
export function getGridRegion(page: Page): Locator {
  if (isJS(page)) {
    return page.locator('[role="grid"]').first();
  }
  return page.locator('[role="region"]').first();
}

/**
 * Assert that the cell at (rowIdx, colIdx) is the active cell.
 * React/Angular/Vue: tabindex="0" on the inner div.
 * JS: data-active-cell="true" on the td.
 */
export async function expectActiveCellAt(
  page: Page,
  rowIdx: number,
  colIdx: number,
): Promise<void> {
  const cell = getCellContent(page, rowIdx, colIdx);
  if (isJS(page)) {
    await expect(cell).toHaveAttribute('data-active-cell', 'true');
  } else {
    await expect(cell).toHaveAttribute('tabindex', '0');
  }
}

/**
 * Get the text filter input inside the open filter popover.
 * React/Angular/Vue: input with placeholder matching /search|enter/i.
 * JS: input with placeholder "Filter..." (aria-label "Text filter").
 */
export function getTextFilterInput(page: Page): Locator {
  if (isJS(page)) {
    return page.locator('.ogrid-header-filter-popover input[type="text"]').first();
  }
  return page.getByPlaceholder(/search|enter/i).first();
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/**
 * Sort a column. React/Angular/Vue use the ⋮ "Column options" menu.
 * JS uses direct header click to toggle sort.
 */
export async function sortColumn(
  page: Page,
  columnName: string,
  direction: 'ascending' | 'descending',
): Promise<void> {
  const th = page.locator('thead th').filter({ hasText: columnName }).first();

  if (isJS(page)) {
    // JS: click header directly (toggles asc  to  desc  to  none)
    await th.click();
    await page.waitForTimeout(300);
    // If we need descending and current is ascending, click again
    if (direction === 'descending') {
      await th.click();
      await page.waitForTimeout(300);
    }
    return;
  }

  // React/Angular/Vue: open ⋮ menu
  const menuBtn = th.getByLabel('Column options');
  await menuBtn.click();
  await page.waitForTimeout(300);

  const fw = getFramework(page);
  if (fw === 'vue-vuetify') {
    // Vuetify column options menu uses role="listitem" (DIV), not role="button"
    const sortItem = page.getByRole('listitem').filter({ hasText: `Sort ${direction}` }).first();
    await expect(sortItem).toBeVisible({ timeout: 2000 });
    await sortItem.click();
  } else if (fw === 'angular-material') {
    // Angular Material uses role="menuitem" for column menu items
    const sortItem = page.getByRole('menuitem', { name: `Sort ${direction}` });
    await expect(sortItem).toBeVisible({ timeout: 2000 });
    await sortItem.click();
  } else {
    const sortBtn = page.getByRole('button', { name: `Sort ${direction}` });
    await expect(sortBtn).toBeVisible({ timeout: 2000 });
    await sortBtn.click();
  }
  await page.waitForTimeout(300);
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/** Click the "Next page" button. */
export async function clickNextPage(page: Page): Promise<void> {
  if (isJS(page)) {
    // JS: ▶ button (last navigation button)
    await page.locator('button:has-text("▶")').click();
  } else {
    await page.getByRole('button', { name: /next page/i }).click();
  }
  await page.waitForTimeout(300);
}

/** Click the "Previous page" button. */
export async function clickPrevPage(page: Page): Promise<void> {
  if (isJS(page)) {
    await page.locator('button:has-text("◀")').click();
  } else {
    await page.getByRole('button', { name: /previous page/i }).click();
  }
  await page.waitForTimeout(300);
}

/** Change the page size via the dropdown. */
export async function changePageSize(page: Page, size: number): Promise<void> {
  const fw = getFramework(page);

  if (fw === 'vue-vuetify') {
    // Vuetify uses a custom VSelect  -  click to open, then select the option
    const selectWrapper = page.locator('.v-select').last();
    await selectWrapper.click();
    await page.waitForTimeout(200);
    const option = page.getByRole('option', { name: String(size) });
    await option.click();
  } else {
    // React, Angular, JS: native <select> or combobox
    const select = page.locator('select').first();
    await select.selectOption(String(size));
  }
  await page.waitForTimeout(300);
}

/** Click a specific page number button. */
export async function clickPageNumber(page: Page, pageNum: number): Promise<void> {
  if (isJS(page)) {
    // JS: plain button with just the number text
    await page.locator(`button:has-text("${pageNum}")`).first().click();
  } else {
    const btn = page.getByRole('button', { name: new RegExp(`^${pageNum}$|page ${pageNum}`, 'i') });
    await btn.click();
  }
  await page.waitForTimeout(300);
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

/** Open the filter popover for a column. Works on all frameworks. */
export async function openFilter(page: Page, columnName: string): Promise<void> {
  // All frameworks use aria-label="Filter {columnName}" on the filter button
  const filterBtn = page.getByRole('button', { name: new RegExp(`filter ${columnName}`, 'i') });
  await filterBtn.click();
  await page.waitForTimeout(300);
}

/** Get the filter popover/dialog container. */
export function getFilterPopover(page: Page): Locator {
  if (isJS(page)) {
    return page.locator('.ogrid-header-filter-popover').first();
  }
  if (getFramework(page) === 'vue-vuetify') {
    // Vuetify uses .v-overlay__content (VMenu/VCard), not role="dialog"
    // Return the one that contains filter content (has "Apply" button)
    return page.locator('.v-overlay__content').filter({ has: page.getByRole('button', { name: /apply/i }) }).first();
  }
  if (getFramework(page) === 'angular-material') {
    // Angular Material renders filters inline in the header (no dialog).
    // The filter panel has class ogrid-header-filter__popover.
    return page.locator('.ogrid-header-filter__popover').first();
  }
  // React Radix uses role="dialog"
  return page.getByRole('dialog');
}

/** Apply the current filter. */
export async function applyFilter(page: Page): Promise<void> {
  if (isJS(page)) {
    await page.locator('.ogrid-filter-apply-btn').click();
  } else {
    await page.getByRole('button', { name: /apply/i }).click();
  }
  await page.waitForTimeout(300);
}

/** Clear the current filter (and apply/close). */
export async function clearFilter(page: Page): Promise<void> {
  if (isJS(page)) {
    // Text filter popovers have .ogrid-filter-clear-btn (Apply + Clear row).
    // Multiselect popovers have .ogrid-filter-clear-sel-btn (in-list clear) but no
    // dedicated "clear all and close" button  -  click Clear then Apply.
    const clearBtn = page.locator('.ogrid-filter-clear-btn').first();
    if (await clearBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await clearBtn.click();
    } else {
      // Multiselect: use the "Clear" (deselect-all) button then Apply
      await page.locator('.ogrid-filter-clear-sel-btn').first().click();
      await page.locator('.ogrid-filter-apply-btn').click();
    }
  } else if (getFramework(page) === 'vue-vuetify') {
    // Vue Vuetify: the filter popover resets the input to empty when reopened.
    // The Clear button is disabled when input is empty, so Apply with empty input clears the filter.
    const clearBtn = page.getByRole('button', { name: /^clear$/i }).first();
    const isEnabled = await clearBtn.isEnabled({ timeout: 500 }).catch(() => false);
    if (isEnabled) {
      await clearBtn.click();
    } else {
      // Input is already empty in popover  -  just apply to clear the active filter
      await page.getByRole('button', { name: /^apply$/i }).click();
    }
  } else {
    // The "Clear" button at the bottom of the filter popover (not the "Clear" in the header)
    await page.getByRole('button', { name: /clear/i }).last().click();
  }
  await page.waitForTimeout(300);
}

// ---------------------------------------------------------------------------
// Column Chooser
// ---------------------------------------------------------------------------

/** Open the column chooser dropdown. */
export async function openColumnChooser(page: Page): Promise<void> {
  if (isJS(page)) {
    await page.locator('button:has-text("Columns")').click();
  } else {
    await page.getByRole('button', { name: /column visibility/i }).click();
  }
  await page.waitForTimeout(200);
}

/**
 * Close the column chooser dropdown.
 * React/Angular/Vue: Escape key dismisses the popover.
 * JS: The dropdown is a toggle  -  click the "Columns" button again to close.
 *     (Escape and clicking outside do NOT close the JS dropdown.)
 */
export async function closeColumnChooser(page: Page): Promise<void> {
  const fw = getFramework(page);
  if (fw === 'js') {
    await page.locator('button:has-text("Columns")').click();
  } else if (fw === 'angular-material') {
    // Angular Material column chooser is a toggle dropdown  -  click the button
    // again to close (Escape does not dismiss it).
    await page.getByRole('button', { name: /column visibility/i }).click();
  } else {
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(200);
}

/**
 * Toggle a column's visibility via the column chooser.
 * React/Vue/JS: click the <label> containing the column name.
 * Angular Material: click the checkbox with the column's aria-label.
 */
export async function toggleColumnInChooser(page: Page, columnName: string): Promise<void> {
  if (getFramework(page) === 'angular-material') {
    // Angular Material uses checkboxes with aria-label, not <label> elements
    await page.getByRole('checkbox', { name: columnName }).click();
  } else {
    const label = page.locator('label').filter({ hasText: new RegExp(columnName) }).first();
    await label.click();
  }
  await page.waitForTimeout(200);
}

// ---------------------------------------------------------------------------
// Cell editing
// ---------------------------------------------------------------------------

/**
 * Enter edit mode on a cell and return the text input.
 * React/Angular/Vue: click then double-click to open the inline editor.
 * JS: click to activate then press Enter (dblclick on plain td works too but
 *     Enter is more reliable since the cell itself has the click handler).
 */
export async function enterCellEdit(page: Page, rowIdx: number, colIdx: number): Promise<Locator> {
  const cell = getCellContent(page, rowIdx, colIdx);
  await cell.click();
  await page.waitForTimeout(200);

  if (isJS(page)) {
    // JS: click activates the cell, Enter opens the inline editor
    await getGridRegion(page).press('Enter');
  } else {
    await cell.dblclick();
  }
  await page.waitForTimeout(500);

  // Wait for the text input to appear
  const input = page.locator('input[type="text"]').first();
  await expect(input).toBeVisible({ timeout: 3000 });
  return input;
}

// ---------------------------------------------------------------------------
// Column options menu
// ---------------------------------------------------------------------------

/**
 * Open the column options (⋮) menu for a named column.
 * React/Angular/Vue: button with aria-label "Column options" inside the th.
 * JS: not applicable  -  skip tests that call this when isJS(page).
 */
export async function openColumnOptions(page: Page, columnName: string): Promise<void> {
  const th = page.locator('thead th').filter({ hasText: columnName }).first();
  await th.getByLabel('Column options').click();
  await page.waitForTimeout(300);
}

// ---------------------------------------------------------------------------
// Context menu
// ---------------------------------------------------------------------------

/**
 * Right-click a cell to open the grid context menu.
 * Activates the cell first with a left-click, then right-clicks.
 */
export async function rightClickCell(page: Page, rowIdx: number, colIdx: number): Promise<void> {
  const cell = getCellContent(page, rowIdx, colIdx);
  await cell.click();
  await page.waitForTimeout(200);
  await cell.click({ button: 'right' });
  await page.waitForTimeout(300);
}

/**
 * Dismiss an open context menu by clicking outside it.
 * Angular Material: the overlay is position:fixed;inset:0 and covers the
 * whole page  -  click the overlay directly at its top-left corner (which is
 * safely outside the context menu that appears near the right-clicked cell).
 * Other frameworks: click the h1 heading or press Escape.
 */
export async function dismissContextMenu(page: Page): Promise<void> {
  if (getFramework(page) === 'angular-material') {
    // Angular Material context menu dismisses on Escape key.
    // The overlay (position:fixed;inset:0) blocks pointer clicks from landing
    // on the context menu host, so force-clicking the overlay does not work.
    await page.keyboard.press('Escape');
  } else {
    await page.locator('h1').first().click();
  }
  await page.waitForTimeout(200);
}

// ---------------------------------------------------------------------------
// Status bar
// ---------------------------------------------------------------------------

/** Return the status bar locator. */
export function getStatusBar(page: Page): Locator {
  if (isJS(page)) {
    return page.locator('.ogrid-status-bar, [role="status"]').first();
  }
  return page.locator('[role="status"]').first();
}

// ---------------------------------------------------------------------------
// Fill handle
// ---------------------------------------------------------------------------

/**
 * Get the fill handle locator on the currently-active cell.
 * The fill handle appears as [aria-label="Fill handle"] inside the active td.
 */
export function getFillHandle(page: Page): Locator {
  return page.locator('[aria-label="Fill handle"]').first();
}

// ---------------------------------------------------------------------------
// Resize handle
// ---------------------------------------------------------------------------

/**
 * Get the column resize separator for a named column.
 * React/Angular: role="separator" with aria-label="Resize {columnName}".
 * Vue Vuetify: .ogrid-resize-handle class (no role="separator").
 * JS: .ogrid-resize-handle inside the th.
 */
export function getResizeHandle(page: Page, columnName: string): Locator {
  const fw = getFramework(page);
  if (fw === 'js' || fw === 'vue-vuetify') {
    const th = page.locator('thead th').filter({ hasText: columnName }).first();
    return th.locator('.ogrid-resize-handle').first();
  }
  if (fw === 'angular-material') {
    // Angular Material: the resize separator uses role="separator" but may not
    // have aria-label set. Fall back to CSS class selector inside the th.
    const th = page.locator('thead th').filter({ hasText: columnName }).first();
    const bySep = th.getByRole('separator');
    return bySep.first();
  }
  return page.getByRole('separator', { name: `Resize ${columnName}` });
}

/**
 * Returns true if the framework supports Ctrl+Z undo after cell edits.
 * Vue Vuetify does not restore the previous value via Ctrl+Z in headless Playwright.
 */
export function supportsUndo(page: Page): boolean {
  const fw = getFramework(page);
  // Vue Vuetify and Angular Material: Ctrl+Z does not restore previous cell
  // values in headless Playwright (keyboard shortcut doesn't reach the grid's
  // undo handler reliably).
  return fw !== 'vue-vuetify' && fw !== 'angular-material';
}

/**
 * Returns true if the framework supports clipboard paste (Ctrl+V) pasting
 * the internal grid clipboard into another cell.
 * Vue Vuetify's clipboard paste does not work in headless Playwright.
 */
export function supportsClipboardPaste(page: Page): boolean {
  const fw = getFramework(page);
  // Vue Vuetify and Angular Material: Ctrl+V does not paste the internal grid
  // clipboard in headless Playwright.
  return fw !== 'vue-vuetify' && fw !== 'angular-material';
}

/**
 * Returns true if the framework supports aria-sort attribute on sorted column headers.
 */
export function supportsAriaSort(_page: Page): boolean {
  return true;
}

/**
 * Get the context menu locator (right-click menu on grid cells).
 * React/Angular: role="menu".
 * Vue Vuetify: role="list" (Vuetify VList).
 */
export function getContextMenu(page: Page): Locator {
  if (getFramework(page) === 'vue-vuetify') {
    return page.locator('[role="list"]').first();
  }
  return page.locator('[role="menu"]').first();
}

/**
 * Get a context menu item by name.
 * React/Angular: role="menuitem" or role="button".
 * Vue Vuetify: role="listitem".
 */
export function getContextMenuItem(page: Page, name: string | RegExp): Locator {
  if (getFramework(page) === 'vue-vuetify') {
    return page.getByRole('listitem').filter({ hasText: name }).first();
  }
  return page.getByRole('button', { name });
}

/**
 * Returns true if the framework uses a custom RichSelect editor with search input
 * for enum cells (Status column). Vue Vuetify uses a native VSelect instead.
 */
export function supportsRichSelect(page: Page): boolean {
  return getFramework(page) !== 'vue-vuetify';
}

/**
 * Returns true if the framework supports cancelling a cell edit via Escape.
 * Vue Vuetify's inline editor does not close/cancel on Escape key.
 */
export function supportsEscapeCancel(page: Page): boolean {
  const fw = getFramework(page);
  // Vue Vuetify inline editor does not cancel on Escape.
  // JS inline editor commits (not cancels) on Escape  -  cancel not supported.
  return fw !== 'vue-vuetify' && fw !== 'js';
}

/**
 * Scroll the grid content area vertically by the given amount.
 * Vue Vuetify + JS: the page itself is the scroll container (region is not independently scrollable).
 * React/Angular: scroll the [role="region"] element directly.
 */
export async function scrollGridVertically(page: Page, scrollTop: number): Promise<void> {
  const fw = getFramework(page);
  if (fw === 'vue-vuetify' || fw === 'js') {
    await page.evaluate((top) => { window.scrollTo(0, top); }, scrollTop);
  } else {
    const region = page.locator('[role="region"]').first();
    await region.evaluate((el, top) => { (el as HTMLElement).scrollTop = top; }, scrollTop);
  }
}

// ---------------------------------------------------------------------------
// Pagination info
// ---------------------------------------------------------------------------

/** Get the default page size for the current framework. */
export function getDefaultPageSize(page: Page): number {
  // JS example uses pageSizeOptions [10, 20, 25, 50, 100] with default 20
  if (isJS(page)) return 20;
  return 25;
}

/** Get the expected row count on the first page. */
export function getFirstPageRowCount(page: Page): number {
  return getDefaultPageSize(page);
}

/** Check if pagination info text is visible matching a pattern. */
export async function expectPaginationInfo(page: Page, pattern: RegExp): Promise<void> {
  await expect(page.locator(`text=${pattern.source}`).first()).toBeVisible({ timeout: 5000 }).catch(async () => {
    // Fallback: find any element containing the text
    const allText = await page.locator('body').textContent();
    expect(allText).toMatch(pattern);
  });
}
