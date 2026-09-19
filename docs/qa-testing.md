# QA Testing — Role-Based UI Test Suite (Playwright)

This document covers the **end-to-end/integration layer** (Playwright, driving the real UI against the real API). There is a separate, faster **unit test layer** (Vitest, 30 tests, `server/src/**/*.test.ts`) covering pure functions and repository business logic in isolation — see the README's [Unit Testing (Vitest)](../README.md#unit-testing-vitest) section for that one; it isn't duplicated here.

## 1. Objective

Validate, automatically and without duplicated login steps, that Simple Help Desk enforces the right access boundaries for its two roles:

- A **Regular User** can only see and use user-level features (My Profile, Submit New Request, My Tickets).
- An **Administrator** can only see and use admin-level features (User Profiles, Query Management).
- Each role is blocked — both in the UI and at the API — from the other role's features.
- Core data entry flows (profile update, ticket submission) actually persist data server-side, not just in local component state.
- Self-registration and admin-created accounts both work, and lead to the correct role's dashboard.
- The ticket conversation model (two-way: both the admin and the ticket's own submitter can post multiple messages, close, reopen) behaves correctly end to end, including the "no responding once closed" rule and the "only the admin or the submitter — nobody else" authorization rule.

All test **data** (credentials, expected UI elements per role, expected API status codes, form payloads) lives in one JSON config file, separate from the test **logic**, so new roles, pages, or checks can be added by editing data rather than rewriting tests.

## 2. Scope

| In scope | Out of scope (for this suite) |
|---|---|
| Login → session establishment for both roles | Cross-browser matrix in CI (Chromium only there; full Chromium+Edge locally — see §9) |
| Role-based nav visibility (UI) | Load/performance testing |
| Role-based API authorization (`/api/users`) | Visual regression / pixel-diff testing |
| Profile self-update persistence | Admin editing another user's profile (covered manually, see main README verification checklist) |
| Ticket submission → visible in "My Tickets" | — |
| Self-registration (admin + user), including duplicate-email rejection | — |
| Admin creating a user directly (no self-registration) | — |
| Both admin and submitter sending multiple messages on one ticket, closing it, and the submitter reopening it | — |

## 3. Test Data Design (data-driven testing)

All scenario data is defined in **[`e2e/config/test-data.json`](../e2e/config/test-data.json)**, shaped by **[`e2e/config/types.ts`](../e2e/config/types.ts)**:

```jsonc
{
  "roles": [
    {
      "role": "admin",
      "label": "Administrator",
      "credentials": { "email": "admin@example.com", "password": "Admin@123" },
      "storageStateFile": "admin.json",
      "loginSuccessTestId": "nav-user-profiles",
      "expectedVisibleNavTestIds": ["nav-user-profiles", "nav-query-management"],
      "expectedAbsentNavTestIds": ["nav-my-profile", "nav-new-request", "nav-my-tickets"],
      "apiChecks": [
        { "description": "admin can list all users", "endpoint": "/api/users", "expectedStatus": 200 }
      ]
    },
    { "role": "user", "...": "same shape, user-level expectations" }
  ],
  "profileUpdate": { "user": { "name": "...", "email": "...", "phone": "...", "address": "..." } },
  "newTicket": { "title": "...", "description": "..." }
}
```

No test file hardcodes an email, password, or expected element. Every test file imports this JSON and either **iterates `roles`** to generate one describe/test block per role, or **looks up a specific role entry** (`data.roles.find(r => r.role === 'user')`) for a single-role flow like profile update.

**To add a third role later** (e.g. "Auditor"): add one object to the `roles` array with its credentials and expected nav test IDs — `auth.setup.ts` and `role-based-access.spec.ts` both pick it up automatically with no code changes, because both loop over the array instead of naming roles individually.

## 4. Steps to Implement

1. **Install Playwright** as a dev dependency at the repo root and download the Chromium browser binary:
   ```bash
   npm install -D @playwright/test --legacy-peer-deps
   npx playwright install chromium
   ```
2. **Configure the runner** — [`playwright.config.ts`](../playwright.config.ts):
   - `testDir: './e2e'`, `baseURL: 'http://localhost:5173'`.
   - `webServer` boots `npm run dev` automatically (and reuses an already-running dev server outside CI), so `npx playwright test` works standalone.
   - Two `projects`: a `setup` project matching `*.setup.ts`, and a `chromium` project that **depends on** `setup`, guaranteeing login always runs first and exactly once per test run.
3. **Add the config layer** (`e2e/config/`):
   - `test-data.json` — the actual data (see §3).
   - `types.ts` — TypeScript shape for that data, so test files get autocomplete/type-checking on `data.roles[i].expectedVisibleNavTestIds` etc.
   - `storage-state.ts` — one helper, `storageStatePath(fileName)`, so every test resolves the `e2e/.auth/*.json` path the same way.
4. **Write the login-and-save step** — [`e2e/auth.setup.ts`](../e2e/auth.setup.ts): for each entry in `data.roles`, fill the real login form (`login-email-input` / `login-password-input` / `login-submit-button`), wait for that role's `loginSuccessTestId` to appear (proof the dashboard actually loaded for that role), then call `page.context().storageState({ path })` to persist cookies to `e2e/.auth/<role>.json`.
5. **Write the role-based access tests** — [`e2e/role-based-access.spec.ts`](../e2e/role-based-access.spec.ts): for each role, `test.use({ storageState: storageStatePath(role.storageStateFile) })` reuses the saved session (no `page.fill` anywhere), then asserts every `expectedVisibleNavTestIds` entry `toBeVisible()` and every `expectedAbsentNavTestIds` entry `toHaveCount(0)`, plus one test per `apiChecks` entry hitting the endpoint directly via `page.request.get()` and asserting the status code.
6. **Write the functional data-driven flows**:
   - [`e2e/profile-update.spec.ts`](../e2e/profile-update.spec.ts) — reuses the user's storage state, fills the profile form from `data.profileUpdate.user`, saves, reloads the page, and re-reads the form fields to prove the update was persisted server-side (not just local state).
   - [`e2e/ticket-submission.spec.ts`](../e2e/ticket-submission.spec.ts) — reuses the user's storage state, submits a ticket built from `data.newTicket` (with a timestamp appended to the title so repeat runs don't collide with leftover data), switches to "My Tickets", and asserts the new row is visible with `status: open`.
   - [`e2e/registration.spec.ts`](../e2e/registration.spec.ts) — no saved storage state (registration only makes sense logged out); loops over `data.registration` to register one admin and one user account with a timestamp-unique email, asserting each lands on its role's dashboard, plus a standalone test asserting a duplicate email is rejected with a visible error.
   - [`e2e/admin-add-user.spec.ts`](../e2e/admin-add-user.spec.ts) — reuses the admin's storage state, opens the "Add User" dialog, submits `data.adminAddUser` with a timestamp-unique email, and asserts the new row appears in the User Profiles table.
   - [`e2e/ticket-conversation.spec.ts`](../e2e/ticket-conversation.spec.ts) — the one spec that needs *two* roles active at once: the `page` fixture (user, via `test.use`) submits a ticket, then a second `browser.newContext({ storageState: ... })` logs in as admin in the same test to send every message in `data.ticketConversation.adminMessages` (status → `answered`). Back on the user's own `page`, the submitter replies with `data.ticketConversation.userReply` — proving a normal user can append to the thread too, not just read it — which flips status back to `open` and confirms the user's view has no close button. The admin then closes the ticket (respond form disappears), and finally the submitter reopens it from their own session.
7. **Gitignore generated artifacts**: `e2e/.auth/`, `playwright-report/`, `test-results/` (already added to [`.gitignore`](../.gitignore)) — these are regenerated by every run, not source.

## 5. Steps to Execute

```bash
# one-time
npm install --legacy-peer-deps
npx playwright install chromium

# run everything headless (boots the dev server itself)
npm run test:e2e

# interactive UI mode — step through tests, inspect the DOM at each action
npm run test:e2e:ui

# open the HTML report from the last run (screenshots/traces on failure)
npm run test:e2e:report
```

Execution order is deterministic: the `setup` project's two tests run first (login as Administrator, login as Regular User, one `context.storageState()` write each), then the `chromium` project's tests run — each `describe` block picks up its role's saved state via `test.use({ storageState })` and never calls the login form again.

## 6. Test Case Matrix (generated from config, not hand-enumerated)

| # | Source | Role | Assertion |
|---|---|---|---|
| 1 | `auth.setup.ts` | Administrator | Login form → session established → `nav-user-profiles` visible → state saved to `admin.json` |
| 2 | `auth.setup.ts` | Regular User | Login form → session established → `nav-my-profile` visible → state saved to `user.json` |
| 3 | `role-based-access.spec.ts` | Administrator | `nav-user-profiles`, `nav-query-management` visible; `nav-my-profile`, `nav-new-request`, `nav-my-tickets` absent |
| 4 | `role-based-access.spec.ts` | Administrator | `GET /api/users` → `200` |
| 5 | `role-based-access.spec.ts` | Regular User | `nav-my-profile`, `nav-new-request`, `nav-my-tickets` visible; `nav-user-profiles`, `nav-query-management` absent |
| 6 | `role-based-access.spec.ts` | Regular User | `GET /api/users` → `403` |
| 7 | `profile-update.spec.ts` | Regular User | Save profile with config values → reload → values still present |
| 8 | `ticket-submission.spec.ts` | Regular User | Submit ticket with config title/description → appears under My Tickets with status `open` |
| 9 | `registration.spec.ts` | Administrator | Register via `/register` with config values → `nav-user-profiles` visible (admin dashboard) |
| 10 | `registration.spec.ts` | Regular User | Register via `/register` with config values → `nav-my-profile` visible (user dashboard) |
| 11 | `registration.spec.ts` | — | Register with the seeded admin's email → `register-error` visible (server's `409` surfaced in the UI) |
| 12 | `admin-add-user.spec.ts` | Administrator | Create user via "Add User" dialog with config values → new row visible in User Profiles table |
| 13 | `ticket-conversation.spec.ts` | Regular User + Administrator | User submits ticket → admin sends every `adminMessages` entry (status → `answered`) → user replies with `userReply` (status → `open`, no close button on their view) → admin closes it → respond form disappears |
| 14 | `ticket-conversation.spec.ts` (same test) | Regular User | Submitter reopens the closed ticket → status returns to `open` |

Cases 3–6 are each generated by a `for (const role of data.roles)` loop, and 9–10 by a loop over `data.registration` — the table above is the current output of those loops, not a hardcoded list.

## 7. Completion Criteria (met)

- [x] Login states are saved once per role and reused (`e2e/.auth/admin.json`, `user.json`).
- [x] Tests use `test.use({ storageState })` (the Playwright Test equivalent of `browser.newContext({ storageState })`) to simulate sessions.
- [x] Role-based feature access is validated with assertions, both in the UI and via direct API calls.
- [x] Admin-specific features are confirmed absent for the regular user, and vice versa.
- [x] No login is repeated across tests — only the two `setup` tests touch the login form.
- [x] All test data is externalized to `e2e/config/test-data.json`; no credentials or expected element IDs are hardcoded in `.spec.ts` files.
- [x] Self-registration is covered for both roles, plus the duplicate-email rejection path.
- [x] Admin-created accounts (not self-registered) are covered.
- [x] The full ticket conversation lifecycle — multiple messages from **both** the admin and the submitter, close, reopen, and the "no responding once closed" UI rule — is covered.
- [x] The suite is wired into CI ([`.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml)) as a hard merge/deploy gate — see the main [README](../README.md#regression-testing-policy--impact-matrix)'s regression testing policy.

## 8. A real bug this suite caught

While writing `ticket-submission.spec.ts`, the test failed: a newly submitted ticket didn't appear under "My Tickets" in the same session. Root cause: the dashboard's section navigation uses Reach UI's `Tabs`, which keeps every panel mounted in the DOM (just `hidden`) rather than mounting it fresh each time a tab is selected — so the "My Tickets" list had already fetched once on page load and never refetched after a ticket was created from a sibling tab. Fixed in `client/src/routes/UserDashboardPage.tsx` by lifting a `ticketsVersion` counter that increments on successful submission and is passed as the `MyTicketsSection`'s React `key`, forcing a remount (and refetch) whenever new data exists. This is exactly the kind of regression this suite exists to catch automatically.

## 9. Known limitations / next steps

- Ticket submission, profile update, registration, and admin-add-user tests all mutate the real `data/db.json` store (by design — there's no test-only database yet). Re-running the suite repeatedly accumulates demo tickets/users; timestamp-unique titles/emails keep assertions correct, but a future improvement would be a `beforeAll`/`globalSetup` hook that resets `data/db.json` to a known seed before each run.
- Locally, both `chromium` and `edge` projects run (`npm run test:e2e`). In CI ([`.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml)), only `chromium` runs — `ubuntu-latest` runners don't have Microsoft Edge installed for the `edge` project's `channel: 'msedge'` to drive. To test additional browsers beyond that, add more entries to the `projects` array in `playwright.config.ts` (e.g. `devices['Desktop Firefox']`, `devices['Desktop Safari']`) — no test code changes needed since assertions are already role/data-driven.
- Admin flows not yet covered by automated tests: editing another user's profile (still manual — see main README verification checklist). Responding to a ticket, closing it, and reopening it *are* now covered (`ticket-conversation.spec.ts`).
- Registration currently lets anyone self-register as **admin** with no approval step (see README's "Security note on open registration"). The suite tests that this works as built, not whether it *should* — a future access-control change here would need this test updated alongside it, not just the app.

## 10. Reflection

- **How did `storageState` improve test performance and structure?** Each role logs in exactly once per run regardless of how many tests use that role — adding `ticket-submission.spec.ts` and `profile-update.spec.ts` cost zero extra logins because they reuse `user.json`.
- **What UI elements were unique to each role?** The entire section nav is role-exclusive: users get `nav-my-profile` / `nav-new-request` / `nav-my-tickets`; admins get `nav-user-profiles` / `nav-query-management`. Because `AppShell` only ever receives one role's section list as props, the other role's elements don't just fail a visibility check — they don't exist in the DOM at all (`toHaveCount(0)`), which is a stronger guarantee than "not visible."
- **How would this scale to 4–5 roles?** Add each role's credentials/expectations as one more object in `test-data.json`'s `roles` array. Both `auth.setup.ts` and `role-based-access.spec.ts` already loop over that array, so no test code changes — only the app itself would need real support for the new role.
- **How does this help the team's QA process?** The config file doubles as living documentation of "what each role is allowed to see" — a non-developer can review or extend `test-data.json` without reading Playwright syntax, and any future access-control regression (like the one in §8) fails the suite immediately instead of surfacing in manual testing or production.
- **How did `ticket-conversation.spec.ts` test two roles in one test, when `test.use({ storageState })` only sets *one* role per file?** `test.use` applies to the `page` fixture Playwright hands the test — fine when a test only ever needs one identity. This scenario genuinely needs both a user and an admin acting within the same test (the admin has to see the ticket the user just created), so instead of `test.use`, the test calls `browser.newContext({ storageState: ... })` directly to open a second, fully independent browser context mid-test, gets its own `page` from that, and closes the context when done. That's the general escape hatch whenever a single test needs more than one signed-in identity at once.
