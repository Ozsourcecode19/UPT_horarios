import { test, expect } from '@playwright/test';

test('presentacion - captura de pantalla', async ({ page }) => {
  await page.goto('/presentacion');
  await expect(page.getByRole('heading', { name: /Horarios académicos sin fricción/i })).toBeVisible();
  await expect(page).toHaveScreenshot('presentacion.png', { fullPage: true });
});