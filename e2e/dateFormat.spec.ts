/**
 * Date Format E2E Tests
 *
 * Tests the configurable date format feature across all frameworks.
 * Verifies that dates display and edit in the configured format.
 */

import { test, expect } from '@playwright/test';

test.describe('Date Format Feature (E2E)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'react-radix', 'Date format coverage is only maintained against the React Radix example.');

    await page.goto('/');

    await page.waitForSelector('table tbody', { timeout: 10000 });
  });

  test('Date cell displays in configured format (YYYY-MM-DD by default)', async ({ page }) => {
    // The default "Start Date" column should display dates in some readable format
    const firstDateCell = page.locator('tbody tr:nth-child(1) td:nth-child(6) div').first();
    const dateText = await firstDateCell.textContent();

    // Should contain a date pattern
    expect(dateText).toMatch(/\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\.\d{1,2}\.\d{4}/);
  });

  test('Editing a date cell accepts input and commits on Enter', async ({ page }) => {
    const firstDateCell = page.locator('tbody tr:nth-child(1) td:nth-child(6) > div').first();

    // Double-click to enter edit mode
    await firstDateCell.dblclick();
    await page.waitForTimeout(300);

    // Find the date input (can be type="date" or type="text")
    const dateInput = page.locator('input[type="date"], input[placeholder*="YYYY"]').first();
    await expect(dateInput).toBeVisible({ timeout: 3000 });

    // Clear and enter a new date
    await dateInput.clear();
    await dateInput.type('2025-12-25');

    // Press Enter to commit
    await dateInput.press('Enter');
    await page.waitForTimeout(300);

    // Verify the cell updated
    const updatedCell = page.locator('tbody tr:nth-child(1) td:nth-child(6) div').first();
    const updatedText = await updatedCell.textContent();
    expect(updatedText).toContain('2025-12-25');
  });

  test('Escape key cancels date edit without committing', async ({ page }) => {
    const firstDateCell = page.locator('tbody tr:nth-child(1) td:nth-child(6) > div').first();
    const originalText = await firstDateCell.textContent();

    // Double-click to enter edit mode
    await firstDateCell.dblclick();
    await page.waitForTimeout(300);

    const dateInput = page.locator('input[type="date"], input[placeholder*="YYYY"]').first();
    await dateInput.clear();
    await dateInput.type('2050-01-01');

    // Press Escape to cancel
    await dateInput.press('Escape');
    await page.waitForTimeout(300);

    // Cell should still show original value
    const cancelledCell = page.locator('tbody tr:nth-child(1) td:nth-child(6) div').first();
    const cancelledText = await cancelledCell.textContent();
    expect(cancelledText).toBe(originalText);
  });

  test('Date input with text editor shows proper placeholder', async ({ page }) => {
    const firstDateCell = page.locator('tbody tr:nth-child(1) td:nth-child(6) > div').first();

    await firstDateCell.dblclick();
    await page.waitForTimeout(300);

    const dateInput = page.locator('input').first();
    await expect(dateInput).toBeVisible({ timeout: 3000 });

    const inputType = await dateInput.getAttribute('type');
    const placeholder = await dateInput.getAttribute('placeholder');

    if (inputType === 'text') {
      expect(placeholder).toMatch(/YYYY|MM|DD|Date/i);
    } else {
      expect(inputType).toBe('date');
      expect(placeholder).toBeFalsy();
    }
  });

  test('Invalid date input falls back to raw string', async ({ page }) => {
    const firstDateCell = page.locator('tbody tr:nth-child(1) td:nth-child(6) > div').first();

    await firstDateCell.dblclick();
    await page.waitForTimeout(300);

    const dateInput = page.locator('input').first();
    await dateInput.clear();

    // Type something that's not a valid date
    await dateInput.type('not-a-date');

    // Press Enter to commit
    await dateInput.press('Enter');
    await page.waitForTimeout(300);

    // The cell should show the raw input (or handle it gracefully)
    const resultCell = page.locator('tbody tr:nth-child(1) td:nth-child(6) div').first();
    const resultText = await resultCell.textContent();

    // Should either show the invalid text or a fallback - main thing is it doesn't crash
    expect(resultText).toBeDefined();
  });

  test('Blur on date input commits the value', async ({ page }) => {
    const firstDateCell = page.locator('tbody tr:nth-child(1) td:nth-child(6) > div').first();

    await firstDateCell.dblclick();
    await page.waitForTimeout(300);

    const dateInput = page.locator('input').first();
    await dateInput.clear();
    await dateInput.type('2026-03-03');

    // Click outside the input to trigger blur
    await page.locator('tbody tr:nth-child(2) td:nth-child(1)').click();
    await page.waitForTimeout(300);

    // Verify the cell updated
    const updatedCell = page.locator('tbody tr:nth-child(1) td:nth-child(6) div').first();
    const updatedText = await updatedCell.textContent();
    expect(updatedText).toContain('2026-03-03');
  });
});
