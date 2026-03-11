import { expect, test, type Locator, type Page } from '@playwright/test';
import { getCellContentByColumnId, getDataCell, getFramework, getGridRegion, waitForGrid } from './helpers';

async function waitForVisible(locator: Locator, timeout: number = 1_200): Promise<boolean> {
  try {
    await locator.first().waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

async function openPopupEditor(page: Page, rowIdx: number, columnId: string, editorSurface: Locator): Promise<void> {
  const grid = getGridRegion(page);
  const attempts: Array<{ label: string; run: () => Promise<void> }> = [
    {
      label: 'double click',
      run: async () => {
        await getCellContentByColumnId(page, rowIdx, columnId).dblclick();
      },
    },
    {
      label: 'click + Enter',
      run: async () => {
        const cell = getCellContentByColumnId(page, rowIdx, columnId);
        await cell.click();
        await page.keyboard.press('Enter');
      },
    },
    {
      label: 'click + F2',
      run: async () => {
        const cell = getCellContentByColumnId(page, rowIdx, columnId);
        await cell.click();
        await page.keyboard.press('F2');
      },
    },
    {
      label: 'grid Enter',
      run: async () => {
        const cell = getCellContentByColumnId(page, rowIdx, columnId);
        await cell.click();
        await grid.press('Enter');
      },
    },
  ];

  for (const attempt of attempts) {
    await attempt.run();
    if (await waitForVisible(editorSurface)) {
      return;
    }
  }

  throw new Error(`Unable to open ${columnId} premium editor after ${attempts.length} activation attempts.`);
}

async function getCellText(page: Page, rowIdx: number, columnId: string): Promise<string> {
  return (await getDataCell(page, rowIdx, columnId).textContent())?.replace(/\s+/g, ' ').trim() ?? '';
}

test.describe('Premium inputs parity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?premiumInputs=1');
    await waitForGrid(page);
  });

  test('date picker Today action commits a new date', async ({ page }) => {
    const before = await getCellText(page, 0, 'dueDate');
    const todayButton = page.getByRole('button', { name: /^today$/i }).first();

    await openPopupEditor(page, 0, 'dueDate', todayButton);
    await todayButton.click();

    await expect.poll(async () => getCellText(page, 0, 'dueDate')).toMatch(/\d{4}-\d{2}-\d{2}/);
    await expect.poll(async () => getCellText(page, 0, 'dueDate')).not.toBe(before);
  });

  test('rating editor commits the clicked rating', async ({ page }) => {
    const framework = getFramework(page);
    const stars = page.locator('button[type="button"]').filter({ hasText: /★|☆/ });
    await openPopupEditor(page, 0, 'rating', stars.first());
    await expect(stars).toHaveCount(5);
    if (framework.startsWith('vue-')) {
      await stars.nth(4).press('Enter');
    } else {
      await stars.nth(4).click({ force: true });
    }

    await expect.poll(async () => getCellText(page, 0, 'rating')).toContain('5');
  });

  test('color picker updates the selected swatch', async ({ page }) => {
    const input = page.locator('input[placeholder="000000"], input[placeholder="#RRGGBB"], input[maxlength="6"], input[maxlength="7"]').first();
    await openPopupEditor(page, 0, 'color', input);
    await expect(input).toBeVisible();
    await input.fill((await input.getAttribute('maxlength')) === '6' ? '1e88e5' : '#1e88e5');
    await input.press('Enter');

    await expect.poll(async () => getCellText(page, 0, 'color')).toMatch(/#1e88e5/i);
  });

  test('slider editor commits a typed value', async ({ page }) => {
    const framework = getFramework(page);
    const input = framework.startsWith('vue-')
      ? getDataCell(page, 0, 'progress').locator('input[type="number"], input[type="text"]').first()
      : page.locator('input[type="number"], input[type="text"]').last();
    await openPopupEditor(page, 0, 'progress', input);
    if (framework.startsWith('vue-')) {
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Enter');
    } else {
      await expect(input).toBeVisible();
      await input.fill('88');
      await input.press('Enter');
    }

    await expect.poll(async () => getCellText(page, 0, 'progress')).toContain('90');
  });

  test('tags editor adds a suggestion and applies it', async ({ page }) => {
    const input = page.locator([
      'tbody td[data-column-id="tags"] input[type="text"]:visible',
      'input[aria-label="Tag search input"]:visible',
      'input[placeholder="Add tag..."]:visible',
      'input[placeholder="Add tags..."]:visible',
      'input[placeholder="Type to add tag..."]:visible',
      'input[placeholder="Search tags..."]:visible',
      'input[placeholder="Search or add tag…"]:visible',
    ].join(', ')).first();
    await openPopupEditor(page, 0, 'tags', input);
    await expect(input).toBeVisible();
    await input.fill('Limited');
    await input.press('Enter');
    await input.press('Enter');

    await expect.poll(async () => getCellText(page, 0, 'tags')).toContain('Limited');
  });
});
