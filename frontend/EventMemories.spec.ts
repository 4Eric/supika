import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * E2E Test Suite: Event Memories
 * Tests the social gallery, media upload, and interactive lightbox.
 */
const USE_REAL_BACKEND = process.env.USE_REAL_BACKEND === 'true';
const BASE_URL = 'http://localhost:5173';

test.describe('Event Memories & Gallery', () => {
    let eventId = '';

    test.beforeEach(async ({ page }) => {
        if (USE_REAL_BACKEND) {
            // Login as Admin to ensure we can upload to any event
            await page.goto(`${BASE_URL}/login`);
            await page.getByPlaceholder('Email').fill('admin@ybyvibe.com');
            await page.getByPlaceholder('Password').fill('password123');
            await page.getByRole('button', { name: 'Login' }).click();
            await expect(page).toHaveURL(BASE_URL + '/');

            // Find an event to test on
            await page.goto(BASE_URL);
            const firstEvent = page.locator('.masonry-card').first();
            await expect(firstEvent).toBeVisible();
            await firstEvent.click();
            
            const currentUrl = page.url();
            eventId = currentUrl.split('/').pop() || '';
        } else {
            // Mock setup
            await page.addInitScript(() => {
                window.localStorage.setItem('token', 'fake-token');
                window.localStorage.setItem('user', JSON.stringify({ id: 'u1', username: 'admin' }));
            });
            await page.route('**/api/auth/me', async (route) => {
                await route.fulfill({ status: 200, json: { id: 'u1', username: 'admin', role: 'user' } });
            });
            await page.route('**/api/events/*', async (route) => {
                if (route.request().method() === 'GET' && !route.request().url().includes('/memories')) {
                    await route.fulfill({ status: 200, json: { id: 1, title: 'Mock Event', createdBy: 'u1', timeSlots: [{id: 1, startTime: new Date().toISOString(), maxAttendees: 10}] } });
                } else {
                    await route.continue();
                }
            });
            await page.route('**/api/events/*/memories', async (route) => {
                if (route.request().method() === 'GET') {
                    await route.fulfill({ status: 200, json: [] });
                } else if (route.request().method() === 'POST') {
                    await route.fulfill({ status: 201, json: { id: 1, mediaUrl: 'test.jpg', mediaType: 'image' } });
                }
            });
            await page.goto(`${BASE_URL}/event/1`);
        }
    });

    test('successfully uploads a memory to the gallery', async ({ page }) => {
        // Click Add Memory button
        const uploadBtn = page.getByRole('button', { name: /Add Memory/i });
        await expect(uploadBtn).toBeVisible();
        await uploadBtn.click();

        // Fill modal (it auto-uploads on file selection)
        const filePath = path.join(__dirname, 'tests/assets/test-event.png');
        await page.setInputFiles('input[type="file"]', filePath);
        
        // Success check
        if (USE_REAL_BACKEND) {
            // Wait for upload to finish and modal to close
            await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 20000 });
            
            // Verify new image appears in gallery
            await expect(page.locator('.memory-card').first()).toBeVisible();
        } else {
            await expect(page.locator('.memory-card')).toBeVisible();
        }
    });
});
