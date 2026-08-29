import { test, expect } from '@playwright/test';

test.describe('Seller Flow', () => {
  test('should protect seller routes', async ({ page }) => {
    await page.goto('/seller');
    
    // Unauthenticated user should be redirected to login
    await expect(page).toHaveURL(/.*\/login/);
  });
});
