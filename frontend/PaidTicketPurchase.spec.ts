import { test, expect } from '@playwright/test';

/**
 * E2E Test Suite: Paid Ticket Purchase (Mocked Stripe)
 * Tests the transition from selecting a paid slot to ticket confirmation.
 */
const BASE_URL = 'http://localhost:5173';

test.describe('Paid Ticket Purchase Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Setup authentication
        await page.addInitScript(() => {
            window.localStorage.setItem('token', 'fake-token');
            window.localStorage.setItem('user', JSON.stringify({ id: 1, username: 'buyer' }));
        });
        await page.route('**/api/auth/me', async (route) => {
            await route.fulfill({ status: 200, json: { id: 1, username: 'buyer', role: 'user' } });
        });

        // Mock event data with a paid slot
        await page.route('**/api/events/*', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    json: {
                        id: 999,
                        title: 'Premium Vibe Gala',
                        ticketPrice: 50.00,
                        currency: 'USD',
                        timeSlots: [{ id: 101, startTime: new Date().toISOString(), maxAttendees: 100 }]
                    }
                });
            } else {
                await route.continue();
            }
        });
    });

    test('completes the purchase journey from checkout to confirmation', async ({ page }) => {
        await page.goto(`${BASE_URL}/event/999`);

        // 1. Select the paid slot
        await page.locator('.time-slot-card').first().click();
        
        // 2. Click Buy Ticket (verifying button label changes for paid events)
        const buyBtn = page.getByRole('button', { name: /Buy Ticket/i });
        await expect(buyBtn).toBeVisible();

        // 3. Intercept Checkout Session Creation
        await page.route('**/api/payments/checkout', async (route) => {
            await route.fulfill({
                status: 200,
                json: { url: `${BASE_URL}/ticket-confirmation?session_id=mock_session_123` }
            });
        });

        await buyBtn.click();

        // 4. Verify redirect to confirmation page (mocking the Stripe bounce)
        await expect(page).toHaveURL(/ticket-confirmation/);
        await expect(page).toHaveURL(/session_id=mock_session_123/);

        // 5. Intercept Transaction Status check
        await page.route('**/api/v1/payments/status/mock_session_123', async (route) => {
            await route.fulfill({
                status: 200,
                json: {
                    status: 'paid',
                    event_title: 'Premium Vibe Gala',
                    amount_total: 5000,
                    currency: 'USD'
                }
            });
        });

        // 6. Verify Confirmation UI
        await expect(page.getByText(/Payment Successful/i)).toBeVisible();
        await expect(page.getByText('Premium Vibe Gala')).toBeVisible();
        await expect(page.getByRole('button', { name: /View Ticket/i })).toBeVisible();
    });
});
