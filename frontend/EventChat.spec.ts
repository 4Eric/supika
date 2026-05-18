import { test, expect, BrowserContext } from '@playwright/test';

/**
 * E2E Test Suite: Real-Time Event Chat
 * Tests asynchronous messaging between two different users (Host and Attendee).
 */
const USE_REAL_BACKEND = process.env.USE_REAL_BACKEND === 'true';
const BASE_URL = 'http://localhost:5173';

test.describe('Real-Time Group Chat', () => {
    test.setTimeout(450000); // 7.5 minutes - real backend can be slow

    let hostContext: BrowserContext;
    let attendeeContext: BrowserContext;
    
    const timestamp = Date.now();
    const EVENT_TITLE = `Chat Test Event ${timestamp}`;
    const MESSAGE_TEXT = `Hello from E2E test ${timestamp}!`;

    test('instant messaging between host and attendee', async ({ browser }) => {
        // 1. Setup Host Session
        hostContext = await browser.newContext();
        const hostPage = await hostContext.newPage();
        
        // Login as Host (Admin)
        await hostPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 60000 });
        
        // Wait for inputs to be visible specifically
        const emailInput = hostPage.getByPlaceholder('you@example.com');
        await emailInput.waitFor({ state: 'visible', timeout: 30000 });
        await emailInput.fill('admin@ybyvibe.com');
        
        await hostPage.getByPlaceholder('••••••••').fill('password123');
        await hostPage.getByRole('button', { name: 'Sign In' }).click();
        await expect(hostPage).toHaveURL(BASE_URL + '/', { timeout: 30000 });

        // 2. Create an event
        await hostPage.goto(`${BASE_URL}/create`, { waitUntil: 'networkidle' });
        await hostPage.getByLabel('Event Title').fill(EVENT_TITLE);
        await hostPage.getByLabel('Description').fill('Event for chat testing');
        await hostPage.getByRole('button', { name: /💻 tech/i }).click();
        
        // Add time slot
        await hostPage.evaluate(() => {
            window.__SET_TIME_SLOT(0, new Date(Date.now() + 86400000).toISOString());
        });

        // Capacity
        await hostPage.locator('.slot-field.small').locator('input').fill('50');

        // Location
        await hostPage.getByLabel('Where').fill('Toronto');
        await hostPage.getByRole('button', { name: '🔍' }).click();
        await hostPage.waitForTimeout(3000); 
        
        // Upload photo
        await hostPage.setInputFiles('input[type="file"]', 'tests/assets/test-event.png');
        await hostPage.waitForTimeout(2000);

        await hostPage.getByRole('button', { name: 'Publish Event' }).click();
        
        try {
            await expect(hostPage).toHaveURL(/\/event\/\d+/, { timeout: 60000 });
        } catch (e) {
            const error = await hostPage.locator('.error-msg').textContent();
            console.error('Publishing failed! Error:', error);
            await hostPage.screenshot({ path: `test-results/chat-create-fail-${timestamp}.png` });
            throw e;
        }
        
        const eventUrl = hostPage.url();

        // 3. Setup Attendee Session
        attendeeContext = await browser.newContext();
        const attendeePage = await attendeeContext.newPage();
        
        // Register new attendee
        const attendeeUser = `Attendee${timestamp}`;
        await attendeePage.goto(`${BASE_URL}/login`);
        await attendeePage.waitForLoadState('networkidle');
        await attendeePage.locator('.toggle-link').getByText('Register').click();
        await attendeePage.getByPlaceholder('Choose a username').fill(attendeeUser);
        await attendeePage.getByPlaceholder('you@example.com').fill(`att${timestamp}@ybyvibe.com`);
        await attendeePage.getByPlaceholder('••••••••').fill('password123');
        await attendeePage.getByRole('button', { name: 'Create Account' }).click();
        await expect(attendeePage).toHaveURL(BASE_URL + '/', { timeout: 30000 });

        // 4. Attendee joins the event
        await attendeePage.goto(eventUrl);
        const firstSlot = attendeePage.locator('.time-slot-card').first();
        await firstSlot.waitFor({ state: 'visible', timeout: 20000 });
        await firstSlot.click();
        await attendeePage.getByRole('button', { name: /Register/i }).click();
        
        try {
            await attendeePage.locator('.vibe-btn').first().click({ timeout: 5000 });
        } catch(e) {}

        await expect(attendeePage.getByText(/You are registered/i)).toBeVisible({ timeout: 20000 });

        // 5. Navigate to Chat
        const joinChatBtn = attendeePage.getByRole('button', { name: /Join Group Chat/i });
        await joinChatBtn.click();
        await expect(attendeePage).toHaveURL(/\/group-chat\/\d+\/\d+/, { timeout: 20000 });
        const chatUrl = attendeePage.url();

        // Host joins
        await hostPage.goto(chatUrl);
        await expect(hostPage.getByPlaceholder('Message group...')).toBeVisible({ timeout: 20000 });

        // 6. Messaging
        await attendeePage.getByPlaceholder('Message group...').fill(MESSAGE_TEXT);
        await attendeePage.getByRole('button', { name: 'Send' }).click();
        await expect(hostPage.getByText(MESSAGE_TEXT)).toBeVisible({ timeout: 25000 });
        
        const replyText = `Host reply ${timestamp}`;
        await hostPage.getByPlaceholder('Message group...').fill(replyText);
        await hostPage.getByRole('button', { name: 'Send' }).click();
        await expect(attendeePage.getByText(replyText)).toBeVisible({ timeout: 25000 });

        await hostContext.close();
        await attendeeContext.close();
    });
});
