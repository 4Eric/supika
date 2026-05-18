import { test, expect } from '@playwright/test';

/**
 * E2E Test Suite: Registration & Check-in Journey
 * 
 * Flows covered:
 * 1. New User Registration
 * 2. Event Discovery & Registration (Free Event)
 * 3. Ticket Retrieval (QR Code Display)
 * 4. Host Perspective: Attendee Management
 * 5. Host Perspective: Manual Check-in (Scanning Simulation)
 */

test.describe('Registration and Host Check-in Flow', () => {
    const timestamp = Date.now();
    const TEST_USER = `User${timestamp}`;
    const TEST_EMAIL = `user${timestamp}@ybyvibe.com`;
    const TEST_PASS = 'Tester123!';
    const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
    
    // Toggle for real backend testing
    const USE_REAL_BACKEND = process.env.USE_REAL_BACKEND === 'true';
    const EVENT_ID = process.env.EVENT_ID || '999';

    test.beforeEach(async ({ page }) => {
        // Disable animations for stability
        await page.emulateMedia({ reducedMotion: 'reduce' });

        if (!USE_REAL_BACKEND) {
            // Intercept common API calls
            await page.route('**/api/messages/unread/count', async (route) => {
                await route.fulfill({ status: 200, json: { unreadCount: 0 } });
            });
        }
    });

    test('full user journey from registration to check-in', async ({ page }) => {
        test.setTimeout(90000);
        // --- 1. MOCK DATA SETUP (Only if not using real backend) ---
        const mockEvent = {
            id: EVENT_ID,
            title: 'The Great Awakening Vibe',
            description: 'A transformative experience in the heart of the digital realm.',
            createdBy: 'host-123',
            organizationName: 'Vibe Tribe',
            ticketPrice: 0,
            requiresApproval: false,
            timeSlots: [
                { id: 101, startTime: new Date(Date.now() + 86400000).toISOString(), attendeeCount: 10, maxAttendees: 50 }
            ],
            hosts: []
        };

        const mockRegistration = {
            id: parseInt(EVENT_ID),
            eventId: parseInt(EVENT_ID),
            timeSlotId: 101,
            status: 'approved',
            ticketToken: 'VIBE-SECRET-TOKEN-777',
            username: TEST_USER
        };

        const mockAttendee = {
            id: 'user-456',
            username: TEST_USER,
            email: TEST_EMAIL,
            status: 'approved',
            rsvpStatus: 'going',
            timeSlot: mockEvent.timeSlots[0].startTime,
            checkInTime: null
        };

        if (!USE_REAL_BACKEND) {
            await page.route('**/api/auth/register', async (route) => {
                await route.fulfill({ status: 201, json: { token: 'fake-user-token', user: { id: 'user-456', username: TEST_USER } } });
            });
            await page.route('**/api/auth/login', async (route) => {
                await route.fulfill({ 
                    status: 200, 
                    json: { token: 'fake-user-token', refreshToken: 'fake-refresh', user: { id: 'user-456', username: TEST_USER } } 
                });
            });
            await page.route('**/api/auth/me', async (route) => {
                await route.fulfill({ status: 200, json: { id: 'user-456', username: TEST_USER, role: 'user' } });
            });
            
            await page.route(`**/api/events/${EVENT_ID}`, async (route) => {
                await route.fulfill({ status: 200, json: mockEvent });
            });
            await page.route(`**/api/events/${EVENT_ID}/attendees`, async (route) => {
                await route.fulfill({ status: 200, json: [mockAttendee] });
            });
            await page.route(`**/api/events/${EVENT_ID}/memories`, async (route) => {
                await route.fulfill({ status: 200, json: [] });
            });
            
            let regCalls = 0;
            await page.route(`**/api/events/registered/me`, async (route) => {
                regCalls++;
                if (regCalls === 1) {
                     await route.fulfill({ status: 200, json: [] });
                } else {
                     await route.fulfill({ status: 200, json: [mockRegistration] });
                }
            });
            await page.route(`**/api/events/${EVENT_ID}/register`, async (route) => {
                await route.fulfill({ status: 200, json: { success: true } });
            });
        }

        // --- 2. USER REGISTRATION ---
        await page.goto(`${BASE_URL}/login`);
        
        // Ensure we are in Register mode
        const registerTab = page.getByRole('button', { name: 'Register' });
        if (await registerTab.isVisible()) {
            await registerTab.click();
        } else {
            // If tabs aren't role=button, try text
            await page.getByText('Register').first().click();
        }
        
        // Select an avatar (idx 0)
        await page.locator('.preset-item').first().waitFor();
        await page.locator('.preset-item').first().click();
        
        await page.getByPlaceholder('Choose a username').fill(TEST_USER);
        await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
        await page.getByPlaceholder('••••••••').fill(TEST_PASS);
        
        await page.getByRole('button', { name: 'Create Account' }).click();
        
        // Wait for redirect to home
        await expect(page).toHaveURL(`${BASE_URL}/`, { timeout: 15000 });

        // --- 3. EVENT REGISTRATION ---
        if (USE_REAL_BACKEND) {
            // Find an event on the home page if no specific ID is provided
            console.log('Using real backend, finding first available event...');
            const eventCard = page.locator('.masonry-card').first();
            await expect(eventCard).toBeVisible({ timeout: 10000 });
            await eventCard.click();
        } else {
            await page.goto(`${BASE_URL}/event/${EVENT_ID}`);
        }
        
        // Select time slot
        console.log('Selecting a time slot...');
        const slotBtn = page.locator('.time-slot-card').first();
        await slotBtn.waitFor({ state: 'visible' });
        await slotBtn.scrollIntoViewIfNeeded();
        
        const slotText = await slotBtn.innerText();
        console.log(`Slot state: ${slotText}`);
        
        await slotBtn.click();

        if (!slotText.includes('Registered')) {
            const completeBtn = page.locator('.primary-btn').filter({ hasText: /Complete Registration|Buy Ticket/i });
            await completeBtn.waitFor({ state: 'visible', timeout: 10000 });
            
            const btnText = await completeBtn.innerText();
            if (btnText.includes('Buy Ticket')) {
                console.log('Event is paid. Trying to find a free event instead...');
                await page.goto(`${BASE_URL}/`);
                // Try second card
                const secondCard = page.locator('.masonry-card').nth(1);
                await secondCard.click();
                await page.locator('.time-slot-card').first().click();
                await completeBtn.waitFor({ state: 'visible' });
            }

            await completeBtn.click();
            
            // If it's a paid event now, we might be at stripe. For this test, we hope it's free.
            if (btnText.includes('Complete Registration')) {
                await expect(page.getByText(/Successfully registered|Request sent/i)).toBeVisible({ timeout: 15000 });
            }
        }
        
        const currentEventUrl = page.url();
        console.log(`Registered for event: ${currentEventUrl}`);

        // --- 4. TICKET / QR CODE ---
        const ticketBtn = page.getByRole('button', { name: /Show Ticket/i });
        await expect(ticketBtn).toBeVisible({ timeout: 15000 });
        await ticketBtn.click();
        await expect(page.getByText('Your Entry Ticket')).toBeVisible();
        await expect(page.locator('.qr-container canvas')).toBeVisible();
        await page.getByRole('button', { name: 'Done' }).click();

        // --- 5. HOST CHECK-IN ---
        if (USE_REAL_BACKEND) {
            console.log('Automating Host Check-in for real backend using admin credentials...');
            
            // Logout the current user
            // We can do this by clearing localStorage and reloading
            await page.evaluate(() => localStorage.clear());
            await page.goto(`${BASE_URL}/login`);

            // Login as Admin
            await page.getByLabel('Email').fill('admin@ybyvibe.com');
            await page.getByLabel('Password').fill('password123');
            await page.getByRole('button', { name: 'Sign In' }).click();
            await expect(page).toHaveURL(`${BASE_URL}/`);

            // Navigate back to the event
            await page.goto(currentEventUrl);
        } else {
            // Host Perspective simulation with mocks
            await page.evaluate(() => {
                localStorage.setItem('user', JSON.stringify({ id: 'host-123', username: 'HostUser', role: 'user' }));
                localStorage.setItem('token', 'fake-host-token');
            });

            await page.route('**/api/auth/me', async (route) => {
                await route.fulfill({ status: 200, json: { id: 'host-123', username: 'HostUser', role: 'user' } });
            });

            await page.route(`**/api/v1/events/${EVENT_ID}/check-in/manual/**`, async (route) => {
                await route.fulfill({ status: 200, json: { success: true, data: { username: TEST_USER } } });
            });
        }

        // Both modes should now be on the event page as a host/admin
        await page.reload(); 
        const manageBtn = page.getByRole('button', { name: /Manage Attendees/i });
        await expect(manageBtn).toBeVisible({ timeout: 10000 });
        await manageBtn.click();
        
        // Wait for list to load
        await expect(page.getByText(/Attendees Hub/i)).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(2000); 

        const userCard = page.locator('li.attendee-card').filter({ hasText: TEST_USER });
        await expect(userCard).toBeVisible({ timeout: 10000 });
        
        // Find the 'Check In' button in this specific card and click
        await userCard.getByRole('button', { name: 'Check In' }).click();
        
        // Verify check-in success in UI
        await expect(userCard.getByText(/Checked In/i)).toBeVisible({ timeout: 10000 });

        if (!USE_REAL_BACKEND) {
            await page.route(`**/api/events/${EVENT_ID}/attendees`, async (route) => {
                await route.fulfill({ 
                    status: 200, 
                    json: [{ ...mockAttendee, checkInTime: new Date().toISOString() }] 
                });
            });
        }

        await expect(userCard.getByText(/Checked In/i)).toBeVisible({ timeout: 10000 });
    });
});
