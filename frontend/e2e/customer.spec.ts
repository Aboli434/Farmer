import { test, expect } from '@playwright/test';

test.describe('Customer Flow', () => {
  // Since we don't have a mocked backend running during the CI, 
  // these tests focus on UI rendering and basic client-side behavior where possible.
  
  test('should display homepage with search bar', async ({ page }) => {
    await page.goto('/');
    
    // The search bar should be visible
    const searchInput = page.getByPlaceholder(/Search for fresh products/i);
    await expect(searchInput).toBeVisible();
    
    // The cart button should be in the header
    const cartButton = page.getByRole('button', { name: /Cart/i });
    await expect(cartButton).toBeVisible();
  });

  test('should allow typing in search and navigating', async ({ page }) => {
    await page.goto('/');
    
    const searchInput = page.getByPlaceholder(/Search for fresh products/i);
    await searchInput.fill('tomato');
    await searchInput.press('Enter');
    
    // Check if the URL gets updated correctly
    await expect(page).toHaveURL(/.*q=tomato/);
  });
});
