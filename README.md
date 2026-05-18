# Supika - Event Management & Discovery Platform

Supika is a full-stack event management application that allows users to create, discover, and manage events. It provides a complete end-to-end journey from event creation and ticketing to QR-code based check-ins and real-time event chats. 

## Features

- **Event Creation & Discovery**: Create rich event listings with locations, time slots, and categories.
- **Ticketing & Payments**: Integrated with Stripe for paid ticket purchases and secure transactions.
- **QR Code Check-ins**: Generate and scan QR codes for seamless event check-ins.
- **Interactive Maps**: Map-based event discovery powered by Leaflet.
- **Event Chat & Memories**: Built-in messaging system for event attendees to communicate.
- **AI Integration**: AI-powered features utilizing Google's Generative AI.
- **Image Management**: Media and image uploads handled via Cloudinary.
- **Progressive Web App (PWA)**: Installable on mobile and desktop for a native-like experience.

## Tech Stack

### Frontend (Vue 3 / Vite)
- **Framework:** Vue 3 (Composition API)
- **Build Tool:** Vite
- **State Management:** Pinia
- **Routing:** Vue Router
- **Maps:** Leaflet & Leaflet MarkerCluster
- **QR Code:** `html5-qrcode` & `qrcode.vue`
- **Testing:** Playwright (E2E)

### Backend (Node.js / Express)
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL (`pg`)
- **Authentication:** JWT & bcryptjs
- **Payments:** Stripe
- **Email:** Resend / Nodemailer
- **Media Storage:** Cloudinary & Multer
- **AI capabilities:** Google Generative AI (`@google/generative-ai`)
- **Testing:** Jest & Supertest (Unit/Integration)

## Architecture Principles

To maintain a high-quality codebase, Supika adheres to the following principles:
- **API-First Backend:** The backend serves as a stateless RESTful API, with strict separation between routes, controllers, and database logic.
- **Component-Driven Frontend:** The frontend is built using highly modular, reusable Vue 3 Composition API components, with global state exclusively managed by Pinia.
- For granular coding standards, please see our [CONTRIBUTING.md](./CONTRIBUTING.md).

## Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL Database
- Stripe Account (for payments)
- Cloudinary Account (for image uploads)
- Google Gemini API Key (for AI features)

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. **Configure Environment:** Copy the example environment file and fill in your credentials.
   ```bash
   cp .env.example .env
   ```
4. **Database Setup:** Initialize the database schema and seed it with fresh data.
   ```bash
   node scripts/setup_pg.js
   node scripts/seed_fresh.js
   ```
5. Start the server:
   ```bash
   npm start
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. **Configure Environment:** Copy the local example environment file.
   ```bash
   cp .env.local.example .env.local
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## Testing & Quality Assurance

Quality is a core pillar of the Supika project. We enforce a strict testing pyramid:

1. **Backend Unit & Integration Tests:** 
   Critical backend logic (like auth and payments) is tested using **Jest** and **Supertest**. These must pass before E2E tests are considered.
   ```bash
   cd backend
   npm test
   ```

2. **Frontend End-to-End (E2E) Tests:** 
   We use **Playwright** to simulate real user journeys (e.g., Event Creation, Ticket Purchases, Check-in).
   ```bash
   cd frontend
   npx playwright test
   ```

## CI/CD & Quality Gates

Our GitHub Actions pipeline (`.github/workflows/ci.yml`) enforces automated quality gates on every Pull Request. A PR cannot be merged unless it passes the following sequence of checks:
1. **Linting & Formatting:** Ensures code adheres to standard styling rules.
2. **Backend Test Suite:** Executes all Jest/Supertest unit and integration tests.
3. **Frontend E2E Test Suite:** Runs Playwright UI tests against the built application.

These automated gates guarantee that the `main` branch remains stable and high-quality at all times.
