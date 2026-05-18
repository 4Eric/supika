# Contributing to Supika

To maintain a high standard of quality, please adhere to the following coding standards and guidelines when contributing to the Supika codebase.

## 1. Backend Standards (Node.js/Express)

### Architecture
- **Separation of Concerns:** Keep your routing, business logic, and database interactions strictly separated.
  - `routes/`: Should only map endpoints to controller functions. No business logic.
  - `controllers/`: Handles request processing, input validation, and business logic.
- **Error Handling:** Use centralized error-handling middlewares. Never leave a promise unhandled. Ensure meaningful HTTP status codes are returned (e.g., 400 for bad input, 401 for unauthorized, 404 for not found).

### Testing
- **Unit & Integration Tests:** All new core functionalities (Auth, Payments, Check-ins) MUST have corresponding Jest/Supertest tests.
- **Coverage:** Aim to cover both the happy paths and extreme edge cases. Tests are an absolute requirement before any PR can be merged.

## 2. Frontend Standards (Vue 3/Vite)

### Architecture
- **State Management:** Use **Pinia** exclusively for global state management. Do not use local storage directly for state unless it's strictly for caching purposes wrapped around a store.
- **Component-Driven:** Keep Vue components small and focused. If a component grows beyond 250 lines, consider breaking it down into smaller, reusable child components.
- **Composition API:** Use Vue 3's Composition API (`<script setup>`) for all new components. Avoid the Options API.

### Testing
- **E2E Tests:** Critical user journeys MUST be covered by Playwright End-to-End tests located in the `frontend/tests/` directory.

## 3. Pull Request Process

1. **Format & Lint:** Ensure your code is properly formatted (Prettier) and passes all linting rules (ESLint) before committing.
2. **Automated Checks:** Our CI/CD pipeline (GitHub Actions) runs all tests automatically. Your PR will be blocked if:
   - Backend unit/integration tests fail.
   - Frontend E2E tests fail.
   - Linting or formatting checks fail.
3. **Review:** Request a code review from a maintainer and address any feedback promptly.
