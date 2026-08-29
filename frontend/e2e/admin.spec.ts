import { test, expect } from '@playwright/test';

test.describe('Admin Flow', () => {
  test('should protect admin routes', async ({ page }) => {
    await page.goto('/admin');
    
    // Unauthenticated user should be redirected to login
    await expect(page).toHaveURL(/.*\/login/);
  });
});
