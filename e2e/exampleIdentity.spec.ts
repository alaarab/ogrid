import { expect, test } from '@playwright/test';

const EXPECTED_TITLES: Record<string, RegExp> = {
  'react-fluent': /React Fluent/i,
  'react-material': /React Material/i,
  'react-radix': /React Radix/i,
  'angular-radix': /Angular Radix/i,
  'angular-material': /Angular Material/i,
  'angular-primeng': /Angular PrimeNG/i,
  'vue-radix': /Vue Radix/i,
  'vue-vuetify': /Vue Vuetify/i,
  'vue-primevue': /Vue PrimeVue/i,
  'js': /Vanilla JS/i,
};

test('serves the expected example for the active Playwright project', async ({ page }, testInfo) => {
  const expectedTitle = EXPECTED_TITLES[testInfo.project.name];
  expect(expectedTitle).toBeDefined();

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(expectedTitle);
});
