import { expect, test, type Page } from '@playwright/test';

async function scoreRound(page: Page, holeCount: number, strokesPerHole: number) {
  for (let hole = 1; hole <= holeCount; hole += 1) {
    for (let stroke = 0; stroke < strokesPerHole; stroke += 1) {
      await page.getByRole('button', { name: `Increase hole ${hole} strokes` }).click();
    }
    if (hole < holeCount) {
      await page.getByRole('button', { name: 'Next hole' }).click();
    }
  }
  await page.getByRole('button', { name: 'Review scorecard' }).click();
}

test('mobile user scores a seeded 9-hole round', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Search courses').fill('Lakeview');
  await page.getByText('Lakeview Nine').click();
  await page.getByRole('button', { name: 'Start round' }).click();

  await scoreRound(page, 9, 4);

  await page.getByRole('button', { name: 'Finish round' }).click();
  await expect(page.getByText('Total 36', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByLabel('Round history')).toContainText('Lakeview Nine');
  await expect(page.getByLabel('Round history')).toContainText('Total 36');
});

test('mobile user scores a provided 18-hole round', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Search courses').fill('Augusta');
  await page.getByLabel('Provided courses').getByText('Augusta National').click();

  await expect(page.getByRole('heading', { name: 'Augusta National' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.reload();

  await expect(page.getByRole('button', { name: /Augusta National/ })).toBeVisible();
  await page.getByRole('button', { name: /Augusta National/ }).click();
  await page.getByRole('button', { name: 'Start round' }).click();

  await page.getByRole('button', { name: /Hole 10, unplayed/ }).click();
  await expect(page.getByRole('heading', { name: 'Hole 10' })).toBeVisible();
  await page.getByRole('button', { name: /Hole 1, unplayed/ }).click();
  await scoreRound(page, 18, 4);

  await page.getByRole('button', { name: 'Finish round' }).click();
  await expect(page.getByText('Total 72', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByLabel('Round history')).toContainText('Augusta National');
  await expect(page.getByLabel('Round history')).toContainText('Total 72');
});
