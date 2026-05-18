# Implementation Plan: Comprehensive E2E Test Suites

This plan outlines the creation and refinement of four critical E2E test suites for the Supika application using Playwright.

## 1. Event Creation & Publishing (`EventCreation.spec.ts`)
Upgrade the existing mock test to support a full real-backend journey.
- **Goal:** Verify a user can create and publish an event successfully.
- **Flow:**
    - Login as a real user.
    - Navigate to `/create`.
    - Fill out Title, Description, Category.
    - Select Location (Mock search if needed).
    - Add Time Slots (Required by backend).
    - Publish and verify redirect to `/event/:id`.
    - Verify event appears on homepage.

## 2. Event Memories (`EventMemories.spec.ts`)
Test the interactive gallery and media upload.
- **Goal:** Verify attendees can contribute to the event's social gallery.
- **Flow:**
    - Login as a registered attendee.
    - Navigate to an event page.
    - Click "Memories" tab.
    - Upload an image file.
    - Verify image appears in list.
    - Open lightbox and navigate.

## 3. Real-Time Group Chat (`EventChat.spec.ts`)
Test the WebSocket-driven chat system.
- **Goal:** Verify instant messaging between attendees.
- **Flow:**
    - Initialize two browser contexts (User A and User B).
    - Both join the same event chat.
    - User A sends a message.
    - Verify User B receives it without refresh.
    - Verify "Unread" count logic if applicable.

## 4. Paid Ticket Purchase (`PaidTicketPurchase.spec.ts`)
Test the Stripe integration flow (using mocks for the Stripe UI).
- **Goal:** Verify the transition from "Buy Ticket" to "Registered" for paid events.
- **Flow:**
    - Register for a paid slot.
    - Intercept Stripe Checkout redirect.
    - Simulate successful return from Stripe.
    - Verify registration record is updated in backend.
    - Verify ticket generation.

---

## Progress Tracker
- [x] Upgrade `CreateEvent.spec.ts` (Real Backend Support)
- [x] Create `EventMemories.spec.ts`
- [x] Create `EventChat.spec.ts`
- [x] Create `PaidTicketPurchase.spec.ts`
