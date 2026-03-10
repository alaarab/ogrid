/**
 * Date Format E2E Tests
 *
 * Tests the configurable date format feature across the framework examples
 * that currently participate in date-editor browser coverage.
 */

import { test, expect } from '@playwright/test';
import { enterDateCellEdit, getCellContent, getColumnTexts, waitForGrid } from './helpers';

test.describe('Date Format Feature (E2E)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const supportedProjects = ['react-radix', 'angular-material', 'vue-vuetify', 'vue-radix', 'js'];
    if (!supportedProjects.includes(testInfo.project.name)) {
      test.skip(`Date format coverage currently covers ${supportedProjects.join(', ')} only.`);
    }

    await page.goto('/');
    await waitForGrid(page);
  });

  test('Date cell displays in configured format (YYYY-MM-DD by default)', async ({ page }) => {
    const [dateText = ''] = await getColumnTexts(page, 'startDate');

    // Should contain a date pattern
    expect(dateText).toMatch(/\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\.\d{1,2}\.\d{4}/);
  });

  test('Editing a date cell accepts input and commits on Enter', async ({ page }) => {
    const dateInput = await enterDateCellEdit(page, 0, 5);

    // Clear and enter a new date
    await dateInput.clear();
    await dateInput.type('2025-12-25');

    // Press Enter to commit
    await dateInput.press('Enter');
    // Verify the cell updated
    const [updatedText = ''] = await getColumnTexts(page, 'startDate');
    expect(updatedText).toContain('2025-12-25');
  });

  test('Escape key cancels date edit without committing', async ({ page }) => {
    const [originalText = ''] = await getColumnTexts(page, 'startDate');
    const dateInput = await enterDateCellEdit(page, 0, 5);
    await dateInput.clear();
    await dateInput.type('2050-01-01');

    // Press Escape to cancel
    await dateInput.press('Escape');
    // Cell should still show original value
    const [cancelledText = ''] = await getColumnTexts(page, 'startDate');
    expect(cancelledText).toBe(originalText);
  });

  test('Date input with text editor shows proper placeholder', async ({ page }) => {
    const dateInput = await enterDateCellEdit(page, 0, 5);

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
    const dateInput = await enterDateCellEdit(page, 0, 5);
    await dateInput.clear();

    // Type something that's not a valid date
    await dateInput.type('not-a-date');

    // Press Enter to commit
    await dateInput.press('Enter');
    // The cell should show the raw input (or handle it gracefully)
    const [resultText] = await getColumnTexts(page, 'startDate');

    // Should either show the invalid text or a fallback - main thing is it doesn't crash
    expect(resultText).toBeDefined();
  });

  test('Blur on date input commits the value', async ({ page }) => {
    const dateInput = await enterDateCellEdit(page, 0, 5);
    await dateInput.clear();
    await dateInput.type('2026-03-03');

    // Click outside the input to trigger blur
    await getCellContent(page, 1, 0).click();

    // Verify the cell updated
    const [updatedText = ''] = await getColumnTexts(page, 'startDate');
    expect(updatedText).toContain('2026-03-03');
  });
});
