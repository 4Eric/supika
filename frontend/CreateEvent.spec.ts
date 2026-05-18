import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * E2E Test Suite: Event Creation Workflow
 * Tests the full process from login to publishing a new event.
 */
const USE_REAL_BACKEND = process.env.USE_REAL_BACKEND === 'true';
const BASE_URL = 'http://localhost:5173';

test.describe('Event Creation Workflow', () => {
    test.setTimeout(300000); // 5 minutes

    const timestamp = Date.now();
    const TEST_USER = `Host${timestamp}`;
    const TEST_EMAIL = `host${timestamp}@ybyvibe.com`;
    const TEST_PASSWORD = 'password123';
    const EVENT_TITLE = `E2E Vibe Check ${timestamp}`;

    test.beforeEach(async ({ page }) => {
        if (USE_REAL_BACKEND) {
            // Register and Login
            await page.goto(`${BASE_URL}/login`);
            await page.waitForLoadState('networkidle');
            await page.locator('.toggle-link').getByText('Register').click();
            await page.getByPlaceholder('Choose a username').fill(TEST_USER);
            await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
            await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
            await page.getByRole('button', { name: 'Create Account' }).click();
            
            // Wait for redirect to home
            await expect(page).toHaveURL(BASE_URL + '/', { timeout: 15000 });
        } else {
            // Mock authentication
            await page.addInitScript(() => {
                window.localStorage.setItem('token', 'fake-token');
                window.localStorage.setItem('user', JSON.stringify({ id: 1, username: 'mockhost' }));
            });
            await page.route('**/api/auth/me', async (route) => {
                await route.fulfill({ status: 200, json: { id: 1, username: 'mockhost', role: 'user' } });
            });
            await page.route('**/api/events', async (route) => {
                if (route.request().method() === 'POST') {
                    await route.fulfill({ status: 201, json: { id: 999 } });
                } else {
                    await route.continue();
                }
            });
        }
    });

    test('successfully creates a new event with multiple time slots and media', async ({ page }) => {
        await page.goto(`${BASE_URL}/create`);

        // 1. Basic Info
        await page.getByLabel('Event Title').fill(EVENT_TITLE);
        await page.getByLabel('Description').fill('An E2E tested event with real media upload.');
        await page.getByRole('button', { name: /💻 tech/i }).click();

        // 2. Time Slots
        await page.evaluate(() => {
            window.__SET_TIME_SLOT(0, new Date(Date.now() + 86400000).toISOString());
        });

        // Capacity
        await page.locator('.slot-field.small').locator('input').fill('50');

        // 3. Location
        await page.getByLabel('Where').fill('Toronto, ON, Canada');
        await page.getByRole('button', { name: '🔍' }).click();
        await page.waitForTimeout(3000); // Wait for geocoding

        // 4. Pricing
        await page.getByLabel('Price (per person)').fill('0');

        // 5. Media Upload
        const filePath = path.join(__dirname, 'tests/assets/test-event.png');
        await page.setInputFiles('input[type="file"]', filePath);
        
        // Wait for preview
        await expect(page.locator('.preview-card')).toBeVisible({ timeout: 10000 });

        // 6. Submit
        await page.getByRole('button', { name: 'Publish Event' }).click();

        // 7. Assert Success Redirect
        try {
            await expect(page).toHaveURL(/\/event\/\d+/, { timeout: 60000 });
        } catch (e) {
            const error = await page.locator('.error-msg').textContent();
            console.error('Event creation failed! Error message:', error);
            await page.screenshot({ path: `test-results/create-fail-${timestamp}.png` });
            throw e;
        }

        const eventUrl = page.url();
        console.log(`Event created successfully at: ${eventUrl}`);

        // 8. Verify Event Visibility on Homepage
        await page.goto(BASE_URL + '/');
        await expect(page.getByText(EVENT_TITLE)).toBeVisible({ timeout: 15000 });
    });
});
