# Simple Help Desk

A help desk web app with separate administrator and normal-user experiences, built with React + TypeScript (Vite) on the frontend and Express + TypeScript on the backend. Data is stored in a local JSON file (`data/db.json`) behind a repository interface, so it can be swapped for a real database later without touching route code. Sessions use an HttpOnly cookie; app data is not stored in cookies.

**New here? Start with [docs/project-documentation.md](docs/project-documentation.md)** — requirements, testing strategy (including what's *not* covered), CI/CD, containerization, and everything worth understanding before making changes. This README is the day-to-day how-to; that document is the map.

## Features

- **Self-service registration**: anyone can create an Administrator or Normal User account from the `/register` page (no invite required — see [Security note](#security-note-on-open-registration) below).
- **Normal user**: My Profile (name, email, phone, address — update & save), Submit New Request (title + description, creates a support ticket), My Tickets (status + a **two-way conversation thread** — reply to the administrator as many times as needed, not just read their response), and the ability to **reopen a closed ticket** if it needs more attention.
- **Administrator**: User Profiles (view/edit any user, plus **add a new user directly** without them self-registering), Query Management (view all tickets, send multiple messages on the same ticket, and close a ticket once resolved).
- **Ticket conversations are genuinely two-way**: the admin and the ticket's own submitter can both keep appending messages to the same thread (anyone else is forbidden). A message from the admin marks the ticket `answered`; a reply from the submitter — including on an already-`answered` ticket — puts it back to `open`, signaling it needs the admin's attention again.
- Both roles log in and land on the same URL, `/dashboard`, which renders the right experience for the signed-in user's role. Role-based access is enforced on both the API and the frontend.
- Accessible UI built with [Reach UI](https://reach.tech/): the section nav is a `Tabs` component, the header's user menu is a `Menu`, and ticket/profile details open in a focus-trapped `Dialog`.
- Logout and a dark/light theme toggle live in the header's user menu (post-login), **and on the login/register pages themselves** so the theme can be set before signing in.
- A cohesive design-token system (`client/src/styles/tokens.css`) with light/dark mode.

## URLs at a glance — which one do I open?

The app runs in three distinct contexts, each with its own port(s). They don't share state (separate `data/db.json` writes are the same file, but separate Node processes/sessions), and **dev and production can run at the same time** without conflicting — that's deliberate, not an accident.

| URL | Mode | Started by | When to use it |
|---|---|---|---|
| **`http://localhost:5173`** | Development | `npm run dev` | **Your main URL while coding.** The Vite dev server — hot module reload, instant feedback on every save. Proxies `/api/*` to the backend below. |
| `http://localhost:4000` | Development (backend only) | `npm run dev` (started alongside 5173) | You normally never open this directly — it's the Express API that `5173` proxies to. Useful for hitting an endpoint directly with `curl`/Postman while debugging. |
| **`https://localhost:4443`** | Production | `npm start` (after `npm run build`), or Docker, **only if a certificate exists** (`npm run certs:generate`) | **The real, production-like URL.** Serves the actual built app over TLS, exactly as it would run in a real deployment. Use this to sanity-check a release build, or to test anything HTTPS-specific (secure cookies, mixed-content behavior). |
| `http://localhost:8080` | Production | `npm start` / Docker | Only matters if you're checking the HTTP→HTTPS redirect itself; otherwise just a `301` to the URL above. If no certificate exists, this becomes the **only** production URL and serves the app directly (see [Running over HTTPS](#running-over-https)). |

**QA / automated testing (Playwright) always targets `http://localhost:5173`** — same URL as development, not a separate one. `playwright.config.ts` boots `npm run dev` itself if it isn't already running, so QA is effectively "development mode, driven by a script instead of a mouse." See [QA Testing](#qa-testing-playwright) below.

**Rule of thumb:**
- Writing/reviewing code → `http://localhost:5173`
- Verifying a release/build works end to end, or testing HTTPS itself → `https://localhost:4443`
- Running the automated regression suite → nothing to open yourself; `npm run test:e2e` drives `5173` for you
- Docker → same two production URLs as above (`8080`/`4443`), just containerized — see [Containerization (Docker)](#containerization-docker)

## Getting started

```bash
npm install --legacy-peer-deps
npm run dev
```

The `--legacy-peer-deps` flag is needed because Reach UI's published peer dependencies only list React 16/17; it works correctly with React 18 in practice, but npm's strict peer-dependency resolution would otherwise refuse the install.

This starts the Express API on `http://localhost:4000` and the Vite dev server on `http://localhost:5173` (which proxies `/api` requests to the API). Open `http://localhost:5173` — see [URLs at a glance](#urls-at-a-glance--which-one-do-i-open) above for how this relates to the production/HTTPS/QA URLs.

On first run, `data/db.json` is seeded automatically with two accounts, used by the automated regression suite (see [QA Testing](#qa-testing-playwright) below) and useful for manual testing — **these are no longer shown on the login page**; register your own account via `/register`, or use these directly:

| Role  | Email             | Password  |
|-------|-------------------|-----------|
| Admin | admin@example.com | Admin@123 |
| User  | user@example.com  | User@123  |

### Security note on open registration

`/register` lets anyone create an **Administrator** account with no approval step — that's a deliberate simplification for this app's current scope, not a production-ready access-control model. Before deploying this publicly, consider gating admin signups behind an invite code, an allow-list of email domains, or removing the role choice from public registration entirely and promoting users to admin manually instead.

## Production build

```bash
npm run build
npm start
```

This builds the client into `client/dist` and the server into `server/dist`, then runs a single Node process that serves both the static frontend and the `/api` routes. By default that's plain HTTP on one port (`PORT` env var, default **`8080`** — deliberately different from dev mode's `4000`, so `npm run dev` and `npm start` can run at the same time without a port clash — see [URLs at a glance](#urls-at-a-glance--which-one-do-i-open)) — see the next section to run it over HTTPS instead, which brings up **two** ports at once.

## Running over HTTPS

The production server (`server/src/index.ts`) can serve the app over TLS in-process — no separate reverse proxy required, though it happily sits behind one too. Whether it does depends entirely on whether a certificate is present; nothing else changes.

### How it decides: HTTP-only vs. HTTP+HTTPS

| Condition | What happens |
|---|---|
| `certs/key.pem` and `certs/cert.pem` **both exist**, and `DISABLE_HTTPS` isn't set | **Two ports are opened at once**: `HTTPS_PORT` (default `4443`) serves the actual app over TLS; `PORT` (default `8080`) stays open only to send a `301` redirect to the HTTPS URL for anything that hits it. The app is never served in plaintext. |
| Either cert file is missing | Falls back to plain HTTP on `PORT` only, exactly like before — with a console warning telling you why. |
| `DISABLE_HTTPS=true` | Forces plain HTTP on `PORT`, **even if certs exist**. This is set automatically by `npm run dev` (see below) — dev mode is never affected by whether you happen to have a `certs/` folder lying around. |

This logic lives entirely in [`server/src/index.ts`](server/src/index.ts) — `SSL_KEY_PATH` / `SSL_CERT_PATH` env vars override the default `certs/key.pem` / `certs/cert.pem` paths if you keep your certificate elsewhere.

### Why `npm run dev` always stays HTTP

The Vite dev server proxies `/api/*` to `http://localhost:4000` in plain HTTP (`client/vite.config.ts`), so [`server/package.json`](server/package.json)'s `dev` script explicitly sets `PORT=4000` to match it — deliberately different from production's own default (`8080`), so the two can run side by side without fighting over a port. That alone doesn't fully rule out HTTPS kicking in on dev's port 4000 though: if a `certs/` folder exists and dev's `PORT=4000` happened to match `SSL`-triggering logic with no other guard, it would become redirect-only and break the Vite proxy (which expects real JSON back, not a `301`). The `dev` script also sets `DISABLE_HTTPS=true` as a second, unconditional guard, so local development never activates HTTPS regardless of `certs/` or which port is in play. **HTTPS only ever activates for the production build (`npm start`) or the Docker image** — never for `npm run dev`.

### Generating a local certificate

For local testing, generate a self-signed certificate:

```bash
npm run certs:generate
```

This runs [`scripts/generate-certs.sh`](scripts/generate-certs.sh) (requires `openssl`, available in Git Bash on Windows, or natively on macOS/Linux) and writes `certs/key.pem` + `certs/cert.pem`, valid for 825 days, with `localhost`/`127.0.0.1` as the certificate's subject/SAN. The `certs/` folder is gitignored — regenerate it on each machine rather than committing it.

Browsers will show a "not secure"/"not trusted" warning for a self-signed cert — that's expected and fine for local testing. To avoid the warning, either:
- Use [`mkcert`](https://github.com/FiloSottile/mkcert) instead (`mkcert -install && mkcert -key-file certs/key.pem -cert-file certs/cert.pem localhost 127.0.0.1`) — it installs a local CA your browser already trusts.
- Or drop in a real certificate (e.g. from Let's Encrypt) at the same two paths for an actual deployment.

### Running it and verifying both ports

```bash
npm run certs:generate   # if you haven't already
npm run build
npm start
```

```bash
# HTTPS — the real app (curl -k skips the self-signed-cert trust check)
curl -k https://localhost:4443/api/auth/me

# HTTP — should 301 redirect to the HTTPS URL above, not serve the app
curl -i http://localhost:8080/api/auth/me
```

Expect `curl -k https://localhost:4443/...` to return a normal API response (`401` if logged out, which is still a real response from the app — not a connection error), and `curl -i http://localhost:8080/...` to return `HTTP/1.1 301 Moved Permanently` with a `Location: https://.../...` header. If instead you see the app respond directly on port 8080, either `DISABLE_HTTPS` is set or no certificate was found — check the server's startup log line, which always states which mode it's running in.

## Containerization (Docker)

The app ships as a single Docker image: one Node process serving both the built React client and the Express `/api` routes, exactly like `npm run build && npm start` (see [Production build](#production-build) above) — the container just wraps that same process, including the [HTTPS behavior](#running-over-https) described above: mount a certificate and the container serves HTTPS + an HTTP→HTTPS redirect on two ports; omit one and it's HTTP-only on one port.

### Files involved

| File | Purpose |
|---|---|
| [`Dockerfile`](Dockerfile) | Multi-stage build: install deps → build client+server → copy compiled output into a minimal runtime image |
| [`.dockerignore`](.dockerignore) | Keeps `node_modules`, `dist/`, `data/db.json`, local certs, and other local/generated files out of the build context |
| [`docker-compose.yml`](docker-compose.yml) | One-command build+run, with both port mappings, the data volume, and the certs bind mount already wired up |

### Prerequisites

- Docker Desktop (or Docker Engine + Compose plugin) installed and running. Verify with:
  ```bash
  docker --version
  docker compose version
  ```

### Step 1 — Build the image

From the repo root (where `Dockerfile` lives):

```bash
docker build -t simplehelpdesk:local .
```

What happens, stage by stage (see [`Dockerfile`](Dockerfile)):
1. **`deps`** — installs every workspace dependency (`npm ci --legacy-peer-deps`), including devDependencies, because the next stage needs `vite` and `tsc` to build.
2. **`build`** — copies the full source tree and runs `npm run build`, producing `client/dist` (static assets) and `server/dist` (compiled JS), identical to the local production build.
3. **`runtime`** — starts from a clean `node:20-alpine`, copies only the compiled `server/dist` and `client/dist` output plus a pruned, production-only `node_modules` (`npm prune --omit=dev`). No TypeScript source, dev tooling, or test files end up in the final image. Runs as the non-root `node` user.

### Step 2 — Configuring the port(s)

The server reads two env vars: `PORT` for plain HTTP (default `8080` in the container/production — **not** `4000`, which is reserved for local `npm run dev`) and `HTTPS_PORT` for HTTPS (default `4443`) — see [Running over HTTPS](#running-over-https) for which one(s) actually end up serving the app. Whichever ports are active, three places must agree whenever you change them:

| Where | What to change |
|---|---|
| `Dockerfile` | `EXPOSE 8080` / `EXPOSE 4443` — documents the container's internal ports (cosmetic; doesn't actually publish them) |
| `docker-compose.yml` → `environment.PORT` / `environment.HTTPS_PORT` | The values the Node process inside the container listens on |
| `docker-compose.yml` → `ports` | `"HOST_PORT:CONTAINER_PORT"` for each port — the **left** number is what you browse to on your machine; the **right** number must match the matching `environment` value above |

Example: to serve HTTPS on `https://localhost:8443` while the container still listens internally on `4443`, only the `ports` mapping in `docker-compose.yml` needs to change:

```yaml
ports:
  - '8080:8080'
  - '8443:4443'
```

To change a container-internal port itself (e.g. HTTPS to `5443`), update **both** the matching `environment` value and the container-side number in `ports` together:

```yaml
environment:
  HTTPS_PORT: '5443'
ports:
  - '8080:8080'
  - '8443:5443'
```

Running the container directly with `docker run` instead of Compose, the equivalent (both ports, with a mounted certificate) is:

```bash
docker run -p 8080:8080 -p 8443:4443 -e PORT=8080 -e HTTPS_PORT=4443 \
  -v "$(pwd)/certs:/app/certs:ro" \
  simplehelpdesk:local
```

Without a mounted `certs/` folder at all, the container just serves plain HTTP on `PORT` — the `-p 8443:4443` mapping and `HTTPS_PORT` env var are harmless no-ops in that case since nothing listens on 4443 internally.

### Step 3 — Data persistence (`data/db.json`)

The app's JSON data store lives at `data/db.json`, resolved relative to the compiled server code to `/app/data/db.json` inside the container ([`server/src/data/db.ts:5`](server/src/data/db.ts#L5)). Containers are ephemeral by default — without a volume, every `docker compose down && docker compose up` (or any container recreation) wipes all users/tickets and reseeds the two demo accounts from scratch.

`docker-compose.yml` already mounts a named volume for this:

```yaml
volumes:
  - simplehelpdesk-data:/app/data
```

To inspect or back up the underlying data without going through the app:

```bash
# copy the live db.json out of the running container
docker compose cp app:/app/data/db.json ./db-backup.json

# see where Docker stores the named volume on the host
docker volume inspect simplehelpdesk_simplehelpdesk-data
```

If you'd rather use a plain host folder instead of a named volume (e.g. to edit `db.json` directly from the host), replace the volume line with a bind mount:

```yaml
volumes:
  - ./data:/app/data
```

### Step 4 — Run it

**Using Compose (recommended — builds and runs in one step):**

```bash
# optional but recommended: generate a local cert first so HTTPS actually
# activates (docker-compose.yml already bind-mounts ./certs into the
# container) — see "Running over HTTPS" above
npm run certs:generate

docker compose up --build
```

Add `-d` to run in the background (`docker compose up --build -d`). With a certificate present, open `https://localhost:4443` (accept the self-signed-cert warning, or use a real cert / mkcert to avoid it); `http://localhost:8080` will just redirect there. Without a certificate, open `http://localhost:8080` directly.

**Using plain Docker (no Compose, manual volume):**

```bash
docker volume create simplehelpdesk-data
docker run --name simplehelpdesk -p 8080:8080 -p 4443:4443 \
  -e PORT=8080 -e HTTPS_PORT=4443 \
  -v simplehelpdesk-data:/app/data \
  -v "$(pwd)/certs:/app/certs:ro" \
  simplehelpdesk:local
```

### Step 5 — Verify it's working

```bash
# container is up and healthy
docker compose ps

# tail logs — with a cert mounted, look for
# "HTTPS server listening on https://localhost:4443" AND
# "HTTP server listening on http://localhost:8080 (redirects to HTTPS)";
# without one, just "HTTP server listening on http://localhost:8080"
docker compose logs -f app

# confirm the API responds on whichever port(s) are active
curl -k https://localhost:4443/api/auth/me   # only if a cert is mounted
curl -i http://localhost:8080/api/auth/me    # 401/200 JSON if HTTP-only, or a 301 redirect if HTTPS is active
```

Then open the app in a browser (see Step 4 for which URL) and log in with the seeded demo accounts (see [Getting started](#getting-started) above) to confirm the full UI loads and authenticates against the containerized API.

### Stopping, rebuilding, and cleaning up

```bash
# stop the container(s), keep the data volume
docker compose down

# stop and also delete the data volume (irreversible — wipes all users/tickets)
docker compose down -v

# rebuild the image after a code change (compose caches layers automatically)
docker compose up --build

# force a completely clean rebuild, ignoring Docker's layer cache
docker compose build --no-cache
```

### Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `docker build` fails on `npm ci` | `package-lock.json` out of sync with a `package.json` — run `npm install --legacy-peer-deps` locally first and commit the updated lockfile |
| Container starts, but a port isn't reachable | Check the three-way `PORT`/`HTTPS_PORT`/`EXPOSE`/`ports` agreement in [Step 2](#step-2--configuring-the-ports); also confirm nothing else on the host already owns that port (`docker compose ps`, or `netstat -ano \| findstr <port>` on Windows) |
| Data resets on every restart | The volume isn't mounted, or you ran `docker compose down -v` — check `docker-compose.yml`'s `volumes:` block and avoid `-v` on routine restarts |
| Login works locally but fails in the container | Confirm you're hitting the container's mapped port, not a stale local dev server still running on `5173`/`4000` — the two are independent processes on different ports by design |
| Port 8080 just redirects instead of serving the app | That's expected once a cert is mounted at `certs/` — see [Running over HTTPS](#running-over-https). Use the HTTPS port (`4443` by default), or remove the `./certs:/app/certs:ro` volume mount to go back to HTTP-only |
| Browser shows a certificate warning | Expected for the self-signed cert from `npm run certs:generate` — accept it for local testing, or use `mkcert`/a real certificate instead (see [Running over HTTPS](#running-over-https)) |

## CI/CD Pipeline

[`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml) runs on every push and pull request to `main`. Each stage gates the next — nothing downstream runs unless everything before it passed:

```
build-and-typecheck  →  regression-tests  →  build-and-push-image  →  deploy-staging  →  deploy-production
   (every push/PR)      (every push/PR,        (main only, on push)      (auto)           (manual approval)
                          the merge gate)
```

| Stage | What it does | Runs on |
|---|---|---|
| **`build-and-typecheck`** | `npm ci --legacy-peer-deps` then `npm run build` — typechecks and builds both `client` and `server`. Same failure mode as a local build error. | Every push and PR to `main` |
| **`regression-tests`** | Installs Playwright's Chromium browser and runs the **entire** Playwright suite (`npx playwright test --project=chromium`) — this is the merge/deploy gate described in [Regression testing policy](#regression-testing-policy--impact-matrix) below. Uploads `playwright-report/` as a build artifact (14-day retention) whether it passes or fails, so a CI failure can be debugged with the same trace viewer used locally. | Every push and PR to `main` |
| **`build-and-push-image`** | Builds the [Dockerfile](#containerization-docker) and pushes it to GitHub Container Registry (`ghcr.io/avijit-samanta/usermanagement`) tagged with both the commit SHA and `latest`. Uses the repo's built-in `GITHUB_TOKEN` — no registry secrets to configure. | Only on a **push to `main`** (not PRs) |
| **`deploy-staging`** | Placeholder — pulls and runs the just-built image against a staging target. Uses a GitHub **Environment** named `staging` (no required reviewers, so it deploys automatically). | After a successful image push |
| **`deploy-production`** | Placeholder — same deploy, against production. Uses a GitHub **Environment** named `production`. | After a successful staging deploy |

### Why Chromium-only in CI

`playwright.config.ts`'s `edge` project drives the system-installed Microsoft Edge via `channel: 'msedge'` (see [Multi-browser execution](#multi-browser-execution) below) — GitHub's `ubuntu-latest` runners don't have Edge installed, so the workflow explicitly runs `--project=chromium` rather than the full multi-browser suite. Edge coverage still runs locally/on Windows (`npm run test:e2e:edge`); this is a CI-environment constraint, not a suite change.

### Setting up the manual approval gate for production

Nothing in the YAML itself blocks `deploy-production` — that's configured in the GitHub repo settings, on the **Environment** the job references:

1. Repo → **Settings** → **Environments** → **New environment** → name it `staging`, save with no protection rules (so it deploys automatically after a successful build).
2. Repeat, naming it `production`, and this time add a **Required reviewers** rule (pick yourself or your team). GitHub will then pause `deploy-production` and wait for one of those reviewers to click "Approve" in the Actions run, every single time it would otherwise run.
3. (Optional) Add environment-specific secrets (e.g. deploy host, SSH key) scoped to each environment under that same settings page, and reference them in the placeholder `run:` steps once a real deploy target exists.

### Wiring up a real deploy target

The `deploy-staging` and `deploy-production` jobs currently just `echo` what they'd do — there's no staging/production host defined yet for this app. To make them real, replace the placeholder `run:` step in each job with something like:

```yaml
- name: Pull and restart the app
  uses: appleboy/ssh-action@v1
  with:
    host: ${{ secrets.DEPLOY_HOST }}
    username: ${{ secrets.DEPLOY_USER }}
    key: ${{ secrets.DEPLOY_SSH_KEY }}
    script: |
      cd /opt/simple-help-desk
      docker compose pull
      docker compose up -d
```
...with `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY` added as secrets on that job's GitHub Environment (see above) — each environment can have its own values, so staging and production point at different hosts.

## Project layout

Key seams:

- `server/src/data/db.ts` — JSON file read/write with a write lock and atomic (temp-file + rename) writes.
- `server/src/data/repositories/` — `userRepository` / `ticketRepository`, the interface boundary where a real database would slot in later.
- `server/src/models/types.ts` — a `Ticket` holds a `messages: TicketMessage[]` conversation thread (not a single response field) and a `status` of `open` | `answered` | `closed`.
- `server/src/routes/tickets.ts` — `PUT /:id/respond` appends a message (admin **or** the ticket's own submitter, blocked once `closed`; a user's message flips status to `open`, an admin's to `answered`), `PUT /:id/close` (admin only), `PUT /:id/reopen` (ticket submitter only, only from `closed`).
- `server/src/routes/auth.ts` — `POST /auth/register` is public self-registration (choosing `admin` or `user`); `server/src/routes/users.ts`'s `POST /users` is the admin-only "add user directly" equivalent.
- `server/src/index.ts` — decides HTTP-only vs. HTTP+HTTPS based on whether `certs/key.pem`/`certs/cert.pem` exist (see [Running over HTTPS](#running-over-https)).
- `scripts/generate-certs.sh` — generates a local self-signed TLS cert/key pair (`npm run certs:generate`).
- `.github/workflows/ci-cd.yml` — the CI/CD pipeline (see [CI/CD Pipeline](#cicd-pipeline)); the Playwright regression suite is its merge/deploy gate.
- `client/src/api/` — typed fetch wrappers per resource.
- `client/src/routes/DashboardPage.tsx` — chooses `UserDashboardPage` or `AdminDashboardPage` by role, both served at `/dashboard`.
- `client/src/routes/RegisterPage.tsx` — public registration form at `/register`, linked from the login page.
- `client/src/hooks/useTheme.ts` — the light/dark theme hook, shared by `AppShell` (post-login) and the login/register pages (pre-login).
- `client/src/components/layout/AppShell.tsx` — the persistent header (user menu with theme toggle + logout) and the `Tabs`-based section nav, shared by both dashboards.
- `client/src/styles/tokens.css` — design tokens (colors, type scale, spacing, radius, shadow); `client/src/styles/global.css` also carries the style overrides for Reach UI's `Tabs`, `Menu`, and `Dialog` components.

## QA Testing (Playwright)

Interactive elements carry stable `data-testid` attributes — login/register form fields, the login/register theme toggle, profile form fields/save button, ticket form fields/submit, the ticket respond textarea/button, the close/reopen ticket buttons, individual conversation messages (`ticket-message`), the "Add User" dialog fields, ticket and user table rows, section nav tabs (`nav-my-profile`, `nav-new-request`, `nav-my-tickets`, `nav-user-profiles`, `nav-query-management`), the header user menu button, the theme-toggle menu item, and the logout menu item — used by the Playwright E2E suite below. `playwright.config.ts` boots the app itself (`npm run dev`, reusing an already-running dev server outside CI) and points tests at `http://localhost:5173` — the same dev URL from [URLs at a glance](#urls-at-a-glance--which-one-do-i-open), not a separate QA-only environment.

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
  registration.spec.ts         # self-registration, both roles + duplicate-email rejection
  admin-add-user.spec.ts       # admin creates a user directly (not self-registered)
  ticket-conversation.spec.ts  # two-way multi-message thread, close, and reopen, admin + user together
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
| 9–10 | `registration.spec.ts` | both | Loops over `data.registration` (one entry per role): fills the `/register` form with a timestamp-unique email, submits, and asserts the role-appropriate dashboard element is visible — proves self-registration logs the new account straight in. |
| 11 | `registration.spec.ts` | — | Attempts to register with the seeded admin's email; asserts `register-error` is shown — proves the server's duplicate-email `409` surfaces as a visible UI error, not a silent failure. |
| 12 | `admin-add-user.spec.ts` | admin | Opens the "Add User" dialog from User Profiles, submits a new account with a timestamp-unique email, and asserts a table row for that email appears — proves an admin-created account doesn't require the new user to self-register. |
| 13 | `ticket-conversation.spec.ts` | user + admin | One test, two browser contexts: the user submits a ticket; a second context logs in as admin and sends every message in `data.ticketConversation.adminMessages` (status → `answered`); back on the user's own context, the submitter replies with `data.ticketConversation.userReply` (asserting it renders as its own `ticket-message` and status flips back to `open`, and that the user's view has no close button); the admin then closes it — asserting the respond form disappears once closed, proving the "no responding to a closed ticket" rule holds in the UI, not just the API. |
| 14 | `ticket-conversation.spec.ts` (same test, continued) | user | Back in the original context, reopens the now-closed ticket and asserts its status returns to `open` — proving only the submitter's reopen action, not a page reload, is what changes it. |

Every test file above generates its cases by looping over `test-data.json` (`for (const role of data.roles)`, or `data.registration`) rather than naming roles individually — the table is the current output of that loop, not a hand-maintained list.

### Updating test data

All scenario data lives in **[`e2e/config/test-data.json`](e2e/config/test-data.json)**. No `.spec.ts` file should ever need a hardcoded email, password, or expected element — if you find yourself editing a spec file to change a value, move that value into this JSON file instead.

- **Change an existing value** (e.g. a different demo password, a different profile field to type into): edit the corresponding key in `test-data.json` directly. `types.ts` will flag a mismatched shape at compile/type-check time.
- **Add a new role** (e.g. a future "Auditor" role): append one object to the `roles` array with its `credentials`, `storageStateFile` name, `loginSuccessTestId`, `expectedVisibleNavTestIds`, `expectedAbsentNavTestIds`, and `apiChecks`. `auth.setup.ts` and `role-based-access.spec.ts` pick it up automatically on the next run — no code changes.
- **Add a new API authorization check** for an existing role: append an object (`description`, `endpoint`, `expectedStatus`) to that role's `apiChecks` array.
- **Add a new functional scenario** (e.g. a different ticket payload): either edit `newTicket` / `profileUpdate` in place, or add a new top-level key to `test-data.json` (and to the `TestData` interface in `types.ts`) and reference it from a new or existing spec file the same way `profile-update.spec.ts` reads `data.profileUpdate.user`. `registration`, `adminAddUser`, and `ticketConversation` are existing examples of exactly this pattern — see `types.ts` for their shapes.
- **Add another admin message to the conversation test**: append a string to `ticketConversation.adminMessages` in `test-data.json` — `ticket-conversation.spec.ts` sends and asserts every entry in that array without any code change. `ticketConversation.userReply` is a single string (the submitter's one reply in that test), not an array — change its text the same way.

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

### Regression testing policy & impact matrix

**Policy: all 14 test cases above must pass before merging to `main`.** This isn't advisory — [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml)'s `regression-tests` job runs the entire suite (`npx playwright test --project=chromium`) on every push/PR, and `build-and-push-image` (and everything downstream of it — staging, then production) only runs if that job succeeded. There's no partial-pass or "skip the flaky one" path in this pipeline; a failing test blocks the deploy, full stop.

The suite doesn't try to guess which tests are "relevant" to a given change — it always runs all of it. The table below exists so a human (reviewing a PR, or deciding whether a change needs a *new* test) knows which existing cases are the ones actually exercising the area being touched, and — this is the part CI can't tell you — **whether a new test needs to be added in the same PR**, since a passing suite that never exercised the new behavior isn't actually evidence of anything.

| Area of the app | Files most likely touched | Existing case(s) that must still pass | New test required when... |
|---|---|---|---|
| Login / session (cookies, `attachUser`) | `server/src/routes/auth.ts`, `server/src/middleware/session.ts`, `AuthContext.tsx` | 1–2 (`auth.setup.ts`, which every other case's `storageState` depends on transitively), 9–10 | Adding a new auth method (e.g. SSO) — login is a dependency of nearly every other case, so a break here tends to cascade into unrelated-looking failures. |
| Self-registration | `server/src/routes/auth.ts`'s `/register`, `RegisterPage.tsx` | 9, 10, 11 | Adding a new required registration field, or changing the duplicate-email behavior. |
| Role / nav visibility, API authorization | `AppShell.tsx`, `requireRole.ts`, `requireAuth.ts` | 3, 4, 5, 6 | Adding a new role (e.g. a future "Auditor") — extend `test-data.json`'s `roles` array (see [Updating test data](#updating-test-data)); no spec code changes needed. |
| Profile update | `server/src/routes/profile.ts`, `ProfileForm.tsx` | 7 | Adding a new profile field. |
| Admin creating a user directly | `server/src/routes/users.ts`'s `POST /users`, `AddUserForm.tsx` | 12 | Changing what fields are required, or who's allowed to create which role. |
| Ticket submission | `server/src/routes/tickets.ts`'s `POST /`, `TicketForm.tsx` | 8 | Adding new ticket fields. |
| Ticket conversation, close, reopen | `server/src/routes/tickets.ts`'s `/respond` `/close` `/reopen`, `server/src/data/repositories/ticketRepository.ts`'s `addMessage`, `server/src/models/types.ts`'s `Ticket`/`TicketMessage`, `TicketDetail.tsx` | 13, 14 | Changing the status state machine (currently: an admin message → `answered`, a submitter message → `open`, `open`/`answered` → `closed` → `open` via reopen), or changing who's allowed to post (currently: admin, or the ticket's own submitter — anyone else is `403`). |
| Any `data-testid` rename | Whichever component | Whichever spec references that testid — a stale testid fails loudly, it doesn't silently pass | Never skip updating the spec in the same PR; a rename that "still passes" usually means the assertion silently stopped running. |

**In short:** touching one of the "files most likely touched" columns above means you should be able to point at the listed case(s) and say "yes, this still covers it" — and if the behavior you're adding isn't described by any existing case, that's the signal a new one belongs in this PR, following the pattern in [Updating test data](#updating-test-data).

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
