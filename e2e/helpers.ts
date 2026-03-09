/**
 * Framework-adaptive Playwright helpers for OGrid E2E tests.
 *
 * These helpers detect the framework from the page URL (port) and use
 * the correct selectors for each framework family:
 *   - React Fluent      (port 3001)
 *   - React Material    (port 3002)
 *   - React Radix       (port 3003)
 *   - Angular Radix     (port 3010)
 *   - Angular Material  (port 3011)
 *   - Angular PrimeNG   (port 3012)
 *   - Vue Radix         (port 3020)
 *   - Vue Vuetify       (port 3021)
 *   - Vue PrimeVue      (port 3022)
 *   - Vanilla JS        (port 3030)
 */

import { expect, type Page, type Locator } from '@playwright/test';
import { DEMO_PAGE_SIZE } from '../packages/examples/src/shared/demoConfig';

// ---------------------------------------------------------------------------
// Framework detection
// ---------------------------------------------------------------------------

export type Framework =
  | 'react-fluent'
  | 'react-material'
  | 'react-radix'
  | 'angular-radix'
  | 'angular-material'
  | 'angular-primeng'
  | 'vue-radix'
  | 'vue-vuetify'
  | 'vue-primevue'
  | 'js';

export function getFramework(page: Page): Framework {
  const url = page.url();
  if (url.includes(':3001')) return 'react-fluent';
  if (url.includes(':3002')) return 'react-material';
  if (url.includes(':3003')) return 'react-radix';
  if (url.includes(':3010')) return 'angular-radix';
  if (url.includes(':3011')) return 'angular-material';
  if (url.includes(':3012')) return 'angular-primeng';
  if (url.includes(':3020')) return 'vue-radix';
  if (url.includes(':3021')) return 'vue-vuetify';
  if (url.includes(':3022')) return 'vue-primevue';
  if (url.includes(':3030')) return 'js';
  // Fallback: try page title
  return 'react-radix';
}

export function isJS(page: Page): boolean {
  return getFramework(page) === 'js';
}

async function isVisible(locator: Locator): Promise<boolean> {
  return locator.isVisible({ timeout: 1_000 }).catch(() => false);
}

async function getVisibleRowSignature(page: Page): Promise<string> {
  return page.locator('tbody tr').evaluateAll((rows) => rows
    .slice(0, 5)
    .map((row) => (row.textContent ?? '').replace(/\s+/g, ' ').trim())
    .join('||'));
}

async function waitForVisibleRowSignatureChange(page: Page, previous: string): Promise<void> {
  await expect.poll(async () => getVisibleRowSignature(page), { timeout: 5_000 }).not.toBe(previous);
}

function getColumnChooserSurfaces(page: Page): Locator[] {
  return [
    page.getByRole('button', { name: /clear all/i }).first(),
    page.getByRole('button', { name: /select all/i }).first(),
    page.locator('text=/Select Columns/i').first(),
    page.locator('label:has(input[type="checkbox"])').first(),
  ];
}

function getColumnOptionsSurfaces(page: Page): Locator[] {
  return [
    page.getByRole('menu').first(),
    page.getByRole('menuitem').first(),
    page.getByRole('button', { name: /sort ascending|sort descending|pin left|pin right/i }).first(),
    page.locator('text=/Sort ascending|Sort descending|Pin left|Pin right/i').first(),
  ];
}

async function waitForAnyVisibleState(locators: Locator[], visible: boolean): Promise<void> {
  await expect.poll(async () => {
    const states = await Promise.all(locators.map((locator) => isVisible(locator)));
    return states.some(Boolean);
  }, { timeout: 5_000 }).toBe(visible);
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
    return page.locator('.ogrid-wrapper[role="region"]').first();
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
  const beforeSignature = await getVisibleRowSignature(page);

  if (isJS(page)) {
    // JS: click header directly (toggles asc  to  desc  to  none)
    await th.click();
    await waitForVisibleRowSignatureChange(page, beforeSignature);
    // If we need descending and current is ascending, click again
    if (direction === 'descending') {
      const afterAscending = await getVisibleRowSignature(page);
      await th.click();
      await waitForVisibleRowSignatureChange(page, afterAscending);
    }
    return;
  }

  // React/Angular/Vue: open the column menu from the real header trigger.
  await openColumnOptions(page, columnName);

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
  await waitForAnyVisibleState(getColumnOptionsSurfaces(page), false);
  await waitForVisibleRowSignatureChange(page, beforeSignature);
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/** Click the "Next page" button. */
export async function clickNextPage(page: Page): Promise<void> {
  const beforeSignature = await getVisibleRowSignature(page);
  if (isJS(page)) {
    // JS: ▶ button (last navigation button)
    await page.locator('button:has-text("▶")').click();
  } else {
    await page.getByRole('button', { name: /next page/i }).click();
  }
  await waitForVisibleRowSignatureChange(page, beforeSignature);
}

/** Click the "Previous page" button. */
export async function clickPrevPage(page: Page): Promise<void> {
  const beforeSignature = await getVisibleRowSignature(page);
  if (isJS(page)) {
    await page.locator('button:has-text("◀")').click();
  } else {
    await page.getByRole('button', { name: /previous page/i }).click();
  }
  await waitForVisibleRowSignatureChange(page, beforeSignature);
}

/** Change the page size via the dropdown. */
export async function changePageSize(page: Page, size: number): Promise<void> {
  const fw = getFramework(page);

  if (fw === 'vue-vuetify') {
    // Vuetify uses a custom VSelect  -  click to open, then select the option
    const selectWrapper = page.locator('.v-select').last();
    await selectWrapper.click();
    const option = page.getByRole('option', { name: String(size) });
    await option.click();
  } else {
    // React, Angular, JS: native <select> or combobox
    const select = page.locator('select').first();
    await select.selectOption(String(size));
  }
  await expect(getRows(page)).toHaveCount(size);
}

/** Click a specific page number button. */
export async function clickPageNumber(page: Page, pageNum: number): Promise<void> {
  const beforeSignature = await getVisibleRowSignature(page);
  if (isJS(page)) {
    // JS: plain button with just the number text
    await page.locator(`button:has-text("${pageNum}")`).first().click();
  } else {
    const btn = page.getByRole('button', { name: new RegExp(`^${pageNum}$|page ${pageNum}`, 'i') });
    await btn.click();
  }
  await waitForVisibleRowSignatureChange(page, beforeSignature);
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

/** Open the filter popover for a column. Works on all frameworks. */
export async function openFilter(page: Page, columnName: string): Promise<void> {
  // All frameworks use aria-label="Filter {columnName}" on the filter button
  const filterBtn = page.getByRole('button', { name: new RegExp(`filter ${columnName}`, 'i') });
  await filterBtn.click();
  await expect(getFilterPopover(page)).toBeVisible({ timeout: 3_000 });
}

/** Get the filter popover/dialog container. */
export function getFilterPopover(page: Page): Locator {
  if (isJS(page)) {
    return page.locator('.ogrid-header-filter-popover').first();
  }
  if (getFramework(page) === 'react-fluent') {
    return page.locator('[class*="filterPopover"], .fui-PopoverSurface').first();
  }
  if (getFramework(page) === 'react-material') {
    return page.locator('.MuiPopover-root, .MuiPopover-paper').first();
  }
  if (getFramework(page) === 'vue-vuetify') {
    return page.locator('.v-overlay__content').filter({ hasText: /apply/i }).first();
  }
  if (getFramework(page) === 'vue-primevue') {
    return page.getByRole('dialog').filter({ hasText: /apply/i }).first();
  }
  if (getFramework(page) === 'angular-material' || getFramework(page) === 'angular-radix') {
    return page.locator('.ogrid-header-filter__popover').first();
  }
  if (getFramework(page) === 'angular-primeng') {
    return page.locator('thead').getByText(/filter:/i).first();
  }
  if (getFramework(page) === 'vue-radix') {
    return page.locator('.popover-header').first();
  }
  return page.getByRole('dialog');
}

/** Apply the current filter. */
export async function applyFilter(page: Page): Promise<void> {
  const popover = getFilterPopover(page);
  if (isJS(page)) {
    await page.locator('.ogrid-filter-apply-btn').click();
  } else {
    await page.getByRole('button', { name: /apply/i }).click();
  }
  await expect(popover).not.toBeVisible({ timeout: 3_000 });
}

/** Clear the current filter (and apply/close). */
export async function clearFilter(page: Page): Promise<void> {
  const popover = getFilterPopover(page);
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
  await expect(popover).not.toBeVisible({ timeout: 3_000 });
}

// ---------------------------------------------------------------------------
// Column Chooser
// ---------------------------------------------------------------------------

/** Open the column chooser dropdown. */
export async function openColumnChooser(page: Page): Promise<void> {
  const fw = getFramework(page);
  if (fw === 'js' || fw === 'angular-radix') {
    await page.locator('button:has-text("Columns")').click();
  } else {
    await page.getByRole('button', { name: /column visibility/i }).click();
  }
  await waitForAnyVisibleState(getColumnChooserSurfaces(page), true);
}

/**
 * Close the column chooser dropdown.
 * React/Angular/Vue: Escape key dismisses the popover.
 * JS: The dropdown is a toggle  -  click the "Columns" button again to close.
 *     (Escape and clicking outside do NOT close the JS dropdown.)
 */
export async function closeColumnChooser(page: Page): Promise<void> {
  const fw = getFramework(page);
  if (fw === 'js' || fw === 'angular-radix') {
    await page.locator('button:has-text("Columns")').click();
  } else if (fw === 'angular-material') {
    // Angular Material column chooser is a toggle dropdown  -  click the button
    // again to close (Escape does not dismiss it).
    await page.getByRole('button', { name: /column visibility/i }).click();
  } else {
    await page.keyboard.press('Escape');
  }
  await waitForAnyVisibleState(getColumnChooserSurfaces(page), false);
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

  if (isJS(page)) {
    // JS: click activates the cell, Enter opens the inline editor
    await getGridRegion(page).press('Enter');
  } else {
    await cell.dblclick();
  }

  // Wait for the text input to appear
  const input = page.locator('input[type="text"]').first();
  await expect(input).toBeVisible({ timeout: 3000 });
  return input;
}

export async function enterDateCellEdit(page: Page, rowIdx: number, colIdx: number): Promise<Locator> {
  const cell = getCellContent(page, rowIdx, colIdx);
  await cell.click();

  if (isJS(page)) {
    await getGridRegion(page).press('Enter');
  } else {
    await cell.dblclick();
  }

  const input = page.locator('input[placeholder*="YYYY"], input[type="date"], input[type="text"]').first();
  await expect(input).toBeVisible({ timeout: 3_000 });
  return input;
}

// ---------------------------------------------------------------------------
// Column options menu
// ---------------------------------------------------------------------------

/**
 * Open the column options (⋮) menu for a named column.
 * All frameworks expose a button with aria-label containing "Column options" inside the th.
 */
export async function openColumnOptions(page: Page, columnName: string): Promise<void> {
  const th = page.locator('thead th').filter({ hasText: columnName }).first();
  await th.hover();
  const trigger = th.getByRole('button', { name: /column options/i }).first();
  await expect(trigger).toBeVisible({ timeout: 3000 });
  await trigger.click();
  await waitForAnyVisibleState(getColumnOptionsSurfaces(page), true);
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
  await cell.click({ button: 'right' });
  await expect(getContextMenu(page)).toBeVisible({ timeout: 3_000 });
}

/**
 * Dismiss an open context menu by clicking outside it.
 * Angular Material: the overlay is position:fixed;inset:0 and covers the
 * whole page  -  click the overlay directly at its top-left corner (which is
 * safely outside the context menu that appears near the right-clicked cell).
 * Other frameworks: click the h1 heading or press Escape.
 */
export async function dismissContextMenu(page: Page): Promise<void> {
  if (getFramework(page) === 'angular-material' || getFramework(page) === 'angular-radix') {
    // Angular wrappers render a full-page overlay; clicking the overlay itself
    // is the real browser equivalent of clicking "outside" the menu.
    const overlay = page.locator('.ogrid-datagrid-context-menu-overlay').first();
    const box = await overlay.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width - 8, box.y + box.height - 8);
    } else {
      await page.keyboard.press('Escape');
    }
  } else {
    await page.locator('h1').first().click();
  }
  await expect(getContextMenu(page)).not.toBeVisible({ timeout: 3_000 });
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
  if (getFramework(page) === 'angular-radix') {
    return page.locator('.ogrid-datagrid-fill-handle').first();
  }
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
  if (fw === 'js' || fw === 'vue-vuetify' || fw === 'angular-radix') {
    const th = page.locator('thead th').filter({ hasText: columnName }).first();
    const className = fw === 'angular-radix' ? '.ogrid-datagrid-resize-handle' : '.ogrid-resize-handle';
    return th.locator(className).first();
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
  if (isJS(page)) {
    return page.locator('[role="menu"], .ogrid-context-menu, body > div').filter({ hasText: /copy|paste|select all/i }).first();
  }
  if (getFramework(page) === 'vue-vuetify') {
    return page.locator('[role="list"]').first();
  }
  if (getFramework(page) === 'vue-primevue') {
    return page.getByRole('menu', { name: /grid context menu/i }).first();
  }
  return page.locator('[role="menu"]').first();
}

/**
 * Get a context menu item by name.
 * React/Angular: role="menuitem" or role="button".
 * Vue Vuetify: role="listitem".
 */
export function getContextMenuItem(page: Page, name: string | RegExp): Locator {
  if (isJS(page)) {
    return page.locator('button, [role="button"], div').filter({ hasText: name }).first();
  }
  if (getFramework(page) === 'vue-vuetify') {
    return page.getByRole('listitem').filter({ hasText: name }).first();
  }
  if (getFramework(page) === 'vue-primevue') {
    return page.getByRole('menuitem').filter({ hasText: name }).first();
  }
  return page.getByRole('button', { name });
}

/**
 * Returns true if the framework uses a custom RichSelect editor with search input
 * for enum cells (Status column). Vue Vuetify uses a native VSelect instead.
 */
export function supportsRichSelect(_page: Page): boolean {
  return true;
}

/**
 * Returns true if the framework supports cancelling a cell edit via Escape.
 * Vue Vuetify's inline editor does not close/cancel on Escape key.
 */
export function supportsEscapeCancel(page: Page): boolean {
  const fw = getFramework(page);
  // JS inline editor closes, but edited values are not discarded on Escape.
  return fw !== 'js';
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
  void page;
  return DEMO_PAGE_SIZE;
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
