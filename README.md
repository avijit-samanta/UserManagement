# NimbusDesk — User Management

A user management web app with separate administrator and normal-user experiences, built with React + TypeScript (Vite) on the frontend and Express + TypeScript on the backend. Data is stored in a local JSON file (`data/db.json`) behind a repository interface, so it can be swapped for a real database later without touching route code. Sessions use an HttpOnly cookie; app data is not stored in cookies.

## Features

- **Normal user**: My Profile (name, email, phone, address — update & save), Submit New Request (title + description, creates a support ticket), My Tickets (status + admin response).
- **Administrator**: User Profiles (view/edit any user), Query Management (view all tickets, respond).
- Both roles log in and land on the same URL, `/dashboard`, which renders the right experience for the signed-in user's role. Role-based access is enforced on both the API and the frontend.
- Accessible UI built with [Reach UI](https://reach.tech/): the section nav is a `Tabs` component, the header's user menu is a `Menu`, and ticket/profile details open in a focus-trapped `Dialog`.
- Logout and a dark/light theme toggle live in the header's user menu, available from every authenticated screen for both roles.
- A cohesive design-token system (`client/src/styles/tokens.css`) with light/dark mode.

## Getting started

```bash
npm install --legacy-peer-deps
npm run dev
```

The `--legacy-peer-deps` flag is needed because Reach UI's published peer dependencies only list React 16/17; it works correctly with React 18 in practice, but npm's strict peer-dependency resolution would otherwise refuse the install.

This starts the Express API on `http://localhost:4000` and the Vite dev server on `http://localhost:5173` (which proxies `/api` requests to the API). Open `http://localhost:5173`.

On first run, `data/db.json` is seeded automatically with two demo accounts:

| Role  | Email             | Password  |
|-------|-------------------|-----------|
| Admin | admin@example.com | Admin@123 |
| User  | user@example.com  | User@123  |

## Production build

```bash
npm run build
npm start
```

This builds the client into `client/dist` and the server into `server/dist`, then runs a single Node process that serves both the static frontend and the `/api` routes on one port (`PORT` env var, default `4000`).

## Project layout

Key seams:

- `server/src/data/db.ts` — JSON file read/write with a write lock and atomic (temp-file + rename) writes.
- `server/src/data/repositories/` — `userRepository` / `ticketRepository`, the interface boundary where a real database would slot in later.
- `client/src/api/` — typed fetch wrappers per resource.
- `client/src/routes/DashboardPage.tsx` — chooses `UserDashboardPage` or `AdminDashboardPage` by role, both served at `/dashboard`.
- `client/src/components/layout/AppShell.tsx` — the persistent header (user menu with theme toggle + logout) and the `Tabs`-based section nav, shared by both dashboards.
- `client/src/styles/tokens.css` — design tokens (colors, type scale, spacing, radius, shadow); `client/src/styles/global.css` also carries the style overrides for Reach UI's `Tabs`, `Menu`, and `Dialog` components.

## QA Testing (Playwright)

Interactive elements carry stable `data-testid` attributes — login form fields, profile form fields/save button, ticket form fields/submit, ticket and user table rows, the respond textarea, section nav tabs (`nav-my-profile`, `nav-new-request`, `nav-my-tickets`, `nav-user-profiles`, `nav-query-management`), the header user menu button, the theme-toggle menu item, and the logout menu item — used by the Playwright E2E suite below. `playwright.config.ts` boots the app itself (`npm run dev`, reusing an already-running dev server outside CI) and points tests at `http://localhost:5173`.

For the full narrative write-up (objectives, scope, reflection, and a real bug this suite caught) see **[docs/qa-testing.md](docs/qa-testing.md)**. This section is the practical how-to: how the test cases are implemented, how to update test data, how to run everything, and how to read the results.

### Implementation of test cases

```
e2e/
  config/
    test-data.json        # all test data — the only file most changes touch
    types.ts               # TypeScript shape for test-data.json
    storage-state.ts        # resolves e2e/.auth/<file> paths
  auth.setup.ts            # logs in once per role, saves storageState
  role-based-access.spec.ts   # nav visibility + API authorization, per role
  profile-update.spec.ts       # user profile save → persists after reload
  ticket-submission.spec.ts    # user submits a ticket → appears under My Tickets
  .auth/                   # generated storageState JSON files (gitignored)
```

`playwright.config.ts` defines two projects so login always runs first and exactly once: a `setup` project matching `*.setup.ts`, and a `chromium` project that `dependencies: ['setup']`.

| # | Spec file | Role | What it implements |
|---|---|---|---|
| 1–2 | `auth.setup.ts` | both | Fills the real login form, waits for a role-specific element to confirm the dashboard loaded, then calls `page.context().storageState({ path })` to save cookies to `e2e/.auth/<role>.json`. Runs once per role no matter how many other spec files exist. |
| 3, 5 | `role-based-access.spec.ts` | both | `test.use({ storageState })` reuses the saved session; asserts every `expectedVisibleNavTestIds` entry is visible and every `expectedAbsentNavTestIds` entry has `toHaveCount(0)` (not just hidden — genuinely absent from the DOM). |
| 4, 6 | `role-based-access.spec.ts` | both | For each entry in that role's `apiChecks`, calls `page.request.get(endpoint)` directly and asserts the HTTP status — proves the restriction is enforced server-side, not just hidden in the UI. |
| 7 | `profile-update.spec.ts` | user | Fills the profile form from `data.profileUpdate.user`, saves, **reloads the page**, and re-reads the form fields — proves the save persisted to the server, not just local component state. |
| 8 | `ticket-submission.spec.ts` | user | Submits a ticket built from `data.newTicket` (title suffixed with a timestamp so repeat runs don't collide), switches to My Tickets, and asserts the new row is visible with status `open`. |

Every test file above generates its cases by looping over `test-data.json` (`for (const role of data.roles)`) rather than naming roles individually — the table is the current output of that loop, not a hand-maintained list.

### Updating test data

All scenario data lives in **[`e2e/config/test-data.json`](e2e/config/test-data.json)**. No `.spec.ts` file should ever need a hardcoded email, password, or expected element — if you find yourself editing a spec file to change a value, move that value into this JSON file instead.

- **Change an existing value** (e.g. a different demo password, a different profile field to type into): edit the corresponding key in `test-data.json` directly. `types.ts` will flag a mismatched shape at compile/type-check time.
- **Add a new role** (e.g. a future "Auditor" role): append one object to the `roles` array with its `credentials`, `storageStateFile` name, `loginSuccessTestId`, `expectedVisibleNavTestIds`, `expectedAbsentNavTestIds`, and `apiChecks`. `auth.setup.ts` and `role-based-access.spec.ts` pick it up automatically on the next run — no code changes.
- **Add a new API authorization check** for an existing role: append an object (`description`, `endpoint`, `expectedStatus`) to that role's `apiChecks` array.
- **Add a new functional scenario** (e.g. a different ticket payload): either edit `newTicket` / `profileUpdate` in place, or add a new top-level key to `test-data.json` (and to the `TestData` interface in `types.ts`) and reference it from a new or existing spec file the same way `profile-update.spec.ts` reads `data.profileUpdate.user`.

### Execution procedure

```bash
# one-time setup
npm install --legacy-peer-deps
npx playwright install chromium

# run the whole suite headless (spawns the dev server itself if one isn't already running)
npm run test:e2e

# interactive UI mode — step through each test, inspect the DOM/network at every action
npm run test:e2e:ui

# run a single spec file
npx playwright test e2e/ticket-submission.spec.ts
npx playwright test e2e/role-based-access.spec.ts 

# run tests whose title matches a string/regex
npx playwright test -g "Administrator"

# run in a visible (headed) browser window instead of headless
npx playwright test --headed

# step-by-step debugger (opens Playwright Inspector)
npx playwright test --debug
```

Execution is always in this order: the `setup` project's two tests run first (login as each role in `test-data.json`, one `storageState` write each), then every browser project's tests run — each `describe` block picks up its role's saved state via `test.use({ storageState })` and never touches the login form again. On a clean checkout, `data/db.json` doesn't exist yet — the server seeds it with the two demo accounts referenced by `test-data.json` on first boot, so no manual setup is needed before running the suite.

### Multi-browser execution

`playwright.config.ts` defines the same test suite against two browser engines, both depending on the same `setup` project so login still only happens once per role regardless of how many browsers run:

- **`chromium`** — Google Chrome's engine, via Playwright's bundled Chromium build.
- **`edge`** — Microsoft Edge, via Playwright's `channel: 'msedge'`, which drives the system-installed Edge rather than downloading a separate browser (no extra install step on Windows, where Edge ships by default).

```bash
# run every browser project (chromium + edge)
npm run test:e2e

# run just one browser project
npm run test:e2e:chromium
npm run test:e2e:edge

# equivalent, if you want other flags alongside it
npx playwright test --project=edge
```

The report and the terminal output both prefix each test with its project name (e.g. `[chromium] › role-based-access.spec.ts`, `[edge] › role-based-access.spec.ts`), so a browser-specific failure is easy to spot without re-running anything.

`workers: 1` in `playwright.config.ts` intentionally serializes all projects — running two full browser engines' worth of tests concurrently on a constrained machine/VM can starve both for CPU and produce misleading failures/timeouts that have nothing to do with the app. If your machine has headroom, pass `--workers=N` (or remove the `workers` line) to parallelize; on a resource-constrained sandbox, keep it serialized.

To add a third browser (e.g. WebKit/Safari engine), add another project to `playwright.config.ts` with `use: { ...devices['Desktop Safari'] }` and `dependencies: ['setup']`, plus a matching `npx playwright install webkit` — no test code changes needed, since every spec is already project-agnostic.

### Running headed / watching tests manually (e.g. via VS Code)

Playwright's defaults (30s per test, 5s per assertion, actions timed against the whole-test timeout) are tuned for fast headless runs, not for a human watching a visible browser window — a test can easily "time out" simply because you paused to look at something, or because the VS Code Playwright extension's own overhead (Inspector, live trace capture) adds latency on top of the app's real response time. `playwright.config.ts` raises these for every run:

| Setting | Default | This project |
|---|---|---|
| Per-test timeout | 30s | **60s** |
| Per-assertion (`expect`) timeout | 5s | **10s** |
| Per-action (`click`/`fill`/…) timeout | 0 (falls back to test timeout) | **15s** |

For actually watching a test execute step by step, use headed mode with an added delay between actions (`slowMo`), controlled by the `PWSLOWMO` environment variable (milliseconds):

```bash
# opens a real browser window, ~400ms pause between every action
npm run test:e2e:headed

# custom delay, e.g. slower for a demo
cross-env PWSLOWMO=800 npx playwright test --headed --project=chromium

# a single spec, headed and slow
cross-env PWSLOWMO=600 npx playwright test e2e/ticket-submission.spec.ts --headed --project=chromium
```

`PWSLOWMO` defaults to `0` (no delay) for every other script, so normal headless/CI runs stay fast — only opt in when you're actually watching.

**Running through the VS Code Playwright extension:** the "Show browser" / headed toggle in the extension uses this same `playwright.config.ts`, so it already gets the raised timeouts above. If a test still times out while you're watching it in that mode:
- Confirm the dev server is actually up first (`curl http://localhost:5173`, or open it in a normal tab) — a hung `webServer` boot is the most common cause of an apparent "test" timeout that's really an app timeout.
- Re-run the same test from the terminal with `npm run test:e2e:headed` (or the `cross-env PWSLOWMO=... --headed` form above) to rule out anything extension-specific.
- If it's consistently slow rather than hung, raise `PWSLOWMO` further, or bump `timeout`/`expect.timeout` in `playwright.config.ts` a second time — both are plain config values, not hardcoded per test.

### Getting and analyzing the report

```bash
npm run test:e2e:report
```

This opens the HTML report from the most recent run (`playwright-report/`, gitignored) in your browser. For each test it shows:

- **Pass/fail status and duration**, grouped by project (`setup`, `chromium`) and spec file.
- **A step-by-step timeline** of every Playwright action in that test (`goto`, `fill`, `click`, `expect`) with its own duration — useful for spotting which step was slow or where an assertion failed.
- **On failure only** (configured in `playwright.config.ts`): a **screenshot** at the moment of failure, a **video** of the whole test, and a **trace** — click "View trace" to open the Trace Viewer, which lets you scrub through every action, inspect the DOM snapshot and network requests at that exact moment, and see the exact assertion that failed (expected vs. actual).
- **The error message and stack trace**, pointing at the exact line in the `.spec.ts` file.

How to analyze a failure, in order:

1. Read the assertion error first — Playwright prints the locator used, the expected condition (e.g. `toBeVisible()`), and how long it waited before giving up.
2. Open the trace for that test and step backward from the failing action to see what the page actually looked like and what API calls had (or hadn't) completed by then.
3. Check whether the failure is a genuine regression (the app changed behavior) or a data problem (e.g. `test-data.json` still references a demo account that no longer exists in `data/db.json` — delete `data/db.json` to force a reseed, or update the JSON to match).
4. If a test is flaky rather than reliably failing, re-run just that test with `--headed` to watch it live before deciding it needs a longer wait/assertion rather than a code fix.

`npx playwright show-report` (equivalent to `npm run test:e2e:report`) can also be pointed at a specific report folder if you keep multiple runs around, e.g. `npx playwright show-report path/to/report`.
