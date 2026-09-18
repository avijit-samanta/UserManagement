# QA Testing — Role-Based UI Test Suite (Playwright)

## 1. Objective

Validate, automatically and without duplicated login steps, that NimbusDesk enforces the right access boundaries for its two roles:

- A **Regular User** can only see and use user-level features (My Profile, Submit New Request, My Tickets).
- An **Administrator** can only see and use admin-level features (User Profiles, Query Management).
- Each role is blocked — both in the UI and at the API — from the other role's features.
- Core data entry flows (profile update, ticket submission) actually persist data server-side, not just in local component state.

All test **data** (credentials, expected UI elements per role, expected API status codes, form payloads) lives in one JSON config file, separate from the test **logic**, so new roles, pages, or checks can be added by editing data rather than rewriting tests.

## 2. Scope

| In scope | Out of scope (for this suite) |
|---|---|
| Login → session establishment for both roles | Cross-browser matrix (currently Chromium only; easy to extend, see §7) |
| Role-based nav visibility (UI) | Load/performance testing |
| Role-based API authorization (`/api/users`) | Visual regression / pixel-diff testing |
| Profile self-update persistence | Admin editing another user's profile (covered manually, see main README verification checklist) |
| Ticket submission → visible in "My Tickets" | Admin responding to a ticket (covered manually) |

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

Cases 3–6 are each generated by a `for (const role of data.roles)` loop — the table above is the current output of that loop for two roles, not a hardcoded list.

## 7. Completion Criteria (met)

- [x] Login states are saved once per role and reused (`e2e/.auth/admin.json`, `user.json`).
- [x] Tests use `test.use({ storageState })` (the Playwright Test equivalent of `browser.newContext({ storageState })`) to simulate sessions.
- [x] Role-based feature access is validated with assertions, both in the UI and via direct API calls.
- [x] Admin-specific features are confirmed absent for the regular user, and vice versa.
- [x] No login is repeated across tests — only the two `setup` tests touch the login form.
- [x] All test data is externalized to `e2e/config/test-data.json`; no credentials or expected element IDs are hardcoded in `.spec.ts` files.

## 8. A real bug this suite caught

While writing `ticket-submission.spec.ts`, the test failed: a newly submitted ticket didn't appear under "My Tickets" in the same session. Root cause: the dashboard's section navigation uses Reach UI's `Tabs`, which keeps every panel mounted in the DOM (just `hidden`) rather than mounting it fresh each time a tab is selected — so the "My Tickets" list had already fetched once on page load and never refetched after a ticket was created from a sibling tab. Fixed in `client/src/routes/UserDashboardPage.tsx` by lifting a `ticketsVersion` counter that increments on successful submission and is passed as the `MyTicketsSection`'s React `key`, forcing a remount (and refetch) whenever new data exists. This is exactly the kind of regression this suite exists to catch automatically.

## 9. Known limitations / next steps

- Ticket submission and profile update tests mutate the real `data/db.json` store (by design — there's no test-only database yet). Re-running the suite repeatedly accumulates demo tickets; the unique timestamped title keeps assertions correct, but a future improvement would be a `beforeAll`/`globalSetup` hook that resets `data/db.json` to a known seed before each run.
- Currently only the `chromium` project runs. To test additional browsers, add more entries to the `projects` array in `playwright.config.ts` (e.g. `devices['Desktop Firefox']`, `devices['Desktop Safari']`) — no test code changes needed since assertions are already role/data-driven.
- Admin flows not yet covered by automated tests (editing another user's profile, responding to a ticket) are documented in the main [README](../README.md#getting-started) manual verification checklist and are good candidates for the next `test-data.json` additions (e.g. an `adminResponse` data block feeding a new spec file).

## 10. Reflection

- **How did `storageState` improve test performance and structure?** Each role logs in exactly once per run regardless of how many tests use that role — adding `ticket-submission.spec.ts` and `profile-update.spec.ts` cost zero extra logins because they reuse `user.json`.
- **What UI elements were unique to each role?** The entire section nav is role-exclusive: users get `nav-my-profile` / `nav-new-request` / `nav-my-tickets`; admins get `nav-user-profiles` / `nav-query-management`. Because `AppShell` only ever receives one role's section list as props, the other role's elements don't just fail a visibility check — they don't exist in the DOM at all (`toHaveCount(0)`), which is a stronger guarantee than "not visible."
- **How would this scale to 4–5 roles?** Add each role's credentials/expectations as one more object in `test-data.json`'s `roles` array. Both `auth.setup.ts` and `role-based-access.spec.ts` already loop over that array, so no test code changes — only the app itself would need real support for the new role.
- **How does this help the team's QA process?** The config file doubles as living documentation of "what each role is allowed to see" — a non-developer can review or extend `test-data.json` without reading Playwright syntax, and any future access-control regression (like the one in §8) fails the suite immediately instead of surfacing in manual testing or production.
