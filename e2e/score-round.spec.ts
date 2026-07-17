import { expect, test } from '@playwright/test';

test('mobile user scores a seeded 9-hole round', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Search courses').fill('Lakeview');
  await page.getByText('Lakeview Nine').click();
  await page.getByRole('button', { name: 'Start round' }).click();

  for (let hole = 1; hole <= 9; hole += 1) {
    await page.getByLabel(`Hole ${hole} strokes`).fill('4');
  }

  await page.getByRole('button', { name: 'Finish round' }).click();
  await expect(page.getByText('Total 36', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByLabel('Round history')).toContainText('Lakeview Nine');
  await expect(page.getByLabel('Round history')).toContainText('Total 36');
});
