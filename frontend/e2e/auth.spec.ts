import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should navigate to login page when unauthenticated', async ({ page }) => {
    // Attempt to access a protected customer route
    await page.goto('/customer/orders');
    
    // Should be redirected to login
    await expect(page).toHaveURL(/.*\/login/);
    await expect(page.locator('h1')).toContainText(/Log in/i);
  });

  test('should display OTP request form correctly', async ({ page }) => {
    await page.goto('/login');
    
    // Phone number input should be visible
    const phoneInput = page.getByPlaceholder(/10-digit mobile number/i);
    await expect(phoneInput).toBeVisible();
    
    // Submit button should be disabled initially
    const submitBtn = page.getByRole('button', { name: /Continue/i });
    await expect(submitBtn).toBeDisabled();
    
    // Fill in a valid phone number
    await phoneInput.fill('9999999999');
    
    // Should become enabled
    await expect(submitBtn).toBeEnabled();
  });
});
