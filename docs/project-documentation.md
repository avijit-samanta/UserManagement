# Simple Help Desk — Project Documentation

A single reference document covering what this project is, what's required to work on it, how it's tested (and how well), and how it ships (CI/CD, containers, HTTPS). This is the "read this first" document — the [README](../README.md) is the day-to-day how-to (commands, URLs, troubleshooting), and [docs/qa-testing.md](qa-testing.md) is the full QA narrative write-up. This document sits above both and tells you which one to go to for detail.

---

## 1. What this project is

A help desk web app with two roles — **Administrator** and **Normal User** — who each get a different dashboard behind the same login. Users submit support tickets and hold a two-way conversation with an admin about them; admins manage users and respond to/close tickets.

| | |
|---|---|
| **Frontend** | React 18 + TypeScript, built with Vite |
| **Backend** | Express + TypeScript, Node 20 |
| **Data store** | A single local JSON file (`data/db.json`) behind a repository interface — not a real database (see §2, "things to understand before starting") |
| **Auth** | HttpOnly session cookie, in-memory session store (server restart clears sessions, not user data) |
| **UI library** | [Reach UI](https://reach.tech/) for accessible `Tabs`, `Menu`, `Dialog` |
| **Testing** | Playwright (E2E/integration only — see §4, there is no unit test suite yet) |
| **CI/CD** | GitHub Actions (`.github/workflows/ci-cd.yml`) |
| **Containerization** | Docker, multi-stage build, optional in-process HTTPS |

---

## 2. Before you start: things you need to understand

These are the load-bearing decisions that shape everything else in this document. Skipping this section is how you end up surprised later.

1. **There is no real database.** `data/db.json` is the entire persistence layer — read/written directly by `server/src/data/db.ts` with a write-lock and atomic temp-file+rename writes. It's structured behind a repository interface (`userRepository`, `ticketRepository`) specifically so a real database can slot in later without touching route code, but that migration hasn't happened.
2. **`data/db.json` is real user data, not disposable test output.** It's gitignored, has no backup, and there is no undo. Do not delete or reseed it as part of "cleanup" — that has actually happened once in this project's history and it cost real data. If you need an isolated database for testing, use the `DB_PATH` env var (`server/src/data/db.ts`) to point at a throwaway file instead.
3. **Self-registration is wide open by design, not by oversight.** `/register` lets anyone create an **Administrator** account with no approval step. That's a deliberate simplification for this app's current scope — see the README's "Security note on open registration" before deploying this anywhere public. Fixing it means gating admin signups (invite code, email allow-list, or removing the role choice from public registration and promoting to admin manually).
4. **Dev and production are structurally separated by port, on purpose.** Dev (`npm run dev`) always uses `4000`/`5173` and always stays plain HTTP; production (`npm start` / Docker) defaults to `8080`/`4443` and goes HTTPS the moment a certificate exists. This was a real bug once (a certificate accidentally present made dev mode's API proxy break) — see README's "Running over HTTPS" for the full story. Don't "fix" the port numbers back to matching without understanding why they're deliberately different.
5. **There is no unit test suite.** Testing today is 100% Playwright, driving the real UI against the real (file-backed) API. See §4 for what that does and doesn't cover, and what a unit test layer would add.
6. **The ticket conversation is two-way.** Both the admin and the ticket's own submitter can post messages; a submitter's message flips status back to `open` (needs admin attention), an admin's message sets it to `answered`. Nobody else can post to a ticket that isn't theirs (`403`).

---

## 3. Functional requirements (as implemented)

### Authentication & accounts
- Login via email/password, HttpOnly session cookie (`server/src/middleware/session.ts`), 8-hour session TTL.
- Self-registration (`/register`) for either role.
- Admin can create a user account directly (any role), without that person registering themselves.
- Two seeded demo accounts on first boot (admin/user) — used by the automated test suite and as a manual fallback login; no longer advertised on the login page itself.

### Normal user
- **My Profile**: view/edit name, email, phone, address.
- **Submit New Request**: title + description → creates a ticket, status `open`.
- **My Tickets**: list own tickets; open one to see the full conversation and reply to it as many times as needed; reopen a ticket once it's been closed.

### Administrator
- **User Profiles**: view/edit any user's profile; add a new user account directly.
- **Query Management**: view all tickets from all users; reply to a ticket's conversation as many times as needed; close a ticket once resolved.

### Ticket lifecycle
```
        submit                admin msg           user msg
 (none) ───────▶ open ───────────────────▶ answered ───────▶ open
                   ▲                                            │
                   │              admin close                   │
                   │  ┌─────────────────────────────────────────┘
                   │  ▼
                   │ closed ────── submitter reopen ──────▶ open
                   └────────────────────────────────────────┘
```
- `open`/`answered` → message from either party is allowed (subject to being the admin or the ticket's own submitter).
- `closed` → no messages accepted from anyone (`400`) until reopened.
- Only the admin can close; only the original submitter can reopen.

### Cross-cutting
- Role-based access enforced **both** in the UI (nav visibility) and at the API (`requireRole`, `requireAuth`, ownership checks) — the UI hiding a feature is not the security boundary; the API check is.
- Dark/light theme toggle, available pre-login (login/register pages) and post-login (header user menu), persisted to `localStorage`.

---

## 4. Testing strategy

### 4a. Unit tests — **not currently implemented**

There is no unit test suite (no Jest/Vitest, no isolated tests of a single function or module). Everything is tested through Playwright driving the real browser against the real running app. This is a real gap, not a stylistic choice — worth knowing before you assume coverage that doesn't exist.

If/when a unit layer is added, the natural first candidates (small, pure, currently untested in isolation) are:

| Candidate | File | Why it's a good unit-test target |
|---|---|---|
| Password hashing/verification | `server/src/utils/password.ts` | Pure function, security-sensitive, cheap to test exhaustively (correct password, wrong password, empty string). |
| ID generation | `server/src/utils/id.ts` | Deterministic-enough logic (ticket ID padding/sequencing, message ID uniqueness) that's easy to assert on directly. |
| Repository logic | `server/src/data/repositories/{user,ticket}Repository.ts` | Business rules like "a user message reopens the ticket, an admin message answers it" are currently only verified end-to-end through the UI — a unit test would catch a regression here in milliseconds instead of during a 45-second Playwright run. |
| Auth/role middleware | `server/src/middleware/{requireAuth,requireRole}.ts` | Small, pure request/response logic — easy to test with mock `req`/`res` objects without booting the whole app. |

Recommended tool if this gets built out: **Vitest** — shares config style with the existing Vite/TS toolchain, needs no separate transpilation setup, and can run against the compiled `server/dist` or directly against `server/src` with `ts-node`/`esbuild`-style transforms.

### 4b. QA / regression suite (Playwright) — what actually exists today

**13 automated test cases**, all currently passing, run against the real dev server (`npm run dev` boots itself if not already running) at `http://localhost:5173`.

| Spec file | # of cases | What it covers |
|---|---|---|
| `auth.setup.ts` | 2 | Logs in as each seeded role once, saves session state for reuse by every other spec (not a "test" in the traditional sense, but a prerequisite every other case depends on). |
| `role-based-access.spec.ts` | 4 | Nav visibility per role (2 cases) + direct API authorization check per role (2 cases) — proves restrictions are enforced server-side, not just hidden in the UI. |
| `profile-update.spec.ts` | 1 | Profile save → reload → values persisted server-side. |
| `ticket-submission.spec.ts` | 1 | Ticket submission → appears under My Tickets with status `open`. |
| `registration.spec.ts` | 3 | Register as admin, register as user (each lands on the correct dashboard), and a duplicate-email registration is rejected with a visible error. |
| `admin-add-user.spec.ts` | 1 | Admin creates a user directly (not self-registered) → appears in User Profiles. |
| `ticket-conversation.spec.ts` | 1 | The big one: user submits a ticket → admin sends multiple messages (`answered`) → **user replies** (`open`, proving the two-way model) → admin closes (`closed`, respond form disappears) → submitter reopens (`open`). Also asserts a third party gets `403` at the API level. |

**What this suite proves:**
- Both roles see only their own dashboard features, both in the DOM and via direct API calls.
- Core data-entry flows (profile update, ticket submission) survive a page reload — proof of server-side persistence, not just React state.
- Self-registration and admin-direct-creation both produce a working, correctly-routed account.
- The full ticket conversation lifecycle — including authorization boundaries (only admin or the ticket's own submitter can post; only admin can close; only the submitter can reopen) — holds up in the real UI, not just at the API layer.

**What this suite does *not* cover** (documented gaps, not silent ones):
- Admin editing *another* user's profile (currently a manual/manual-checklist item — see README's verification checklist).
- Load/performance testing, visual regression, or a full cross-browser matrix in CI (CI runs Chromium only; Chromium+Edge run locally — see README's "Why Chromium-only in CI").
- Any scenario requiring more than the 2 seeded roles (no 3rd role exists in the app yet to test against).

**Policy:** all 13 cases must pass before merge — this isn't advisory, `.github/workflows/ci-cd.yml`'s `regression-tests` job is a hard gate; nothing downstream (image build, staging, production) runs if it fails. Full case-by-case detail, plus a change-impact matrix ("if you touch X, cases Y/Z must still pass, and here's when a new case is required") lives in the README's [Regression testing policy & impact matrix](../README.md#regression-testing-policy--impact-matrix) — that table is the living source of truth; this document summarizes it, doesn't replace it.

---

## 5. CI/CD — current state and how to extend it

`.github/workflows/ci-cd.yml` runs on every push/PR to `main`:

```
build-and-typecheck → regression-tests → build-and-push-image → deploy-staging → deploy-production
   (every push/PR)      (the hard gate)     (main only, on push)      (auto)        (manual approval)
```

| Stage | What it does today |
|---|---|
| `build-and-typecheck` | `npm ci` + `npm run build` (typechecks and builds both client and server). |
| `regression-tests` | Installs Chromium, runs the full 13-case Playwright suite. Uploads the HTML report as an artifact regardless of pass/fail. |
| `build-and-push-image` | Builds the Docker image, pushes to GHCR (`ghcr.io/<owner>/<repo>`) tagged with the commit SHA and `latest`. Uses the repo's built-in `GITHUB_TOKEN` — no registry secrets needed. |
| `deploy-staging` / `deploy-production` | **Placeholders.** They currently just `echo` what they'd do. Production is gated behind a GitHub Environment with required reviewers — the manual-approval mechanism already exists, it just has nothing real to deploy to yet. |

### How to integrate a real deployment target

1. Stand up a staging/production host (VM, ECS, k8s, whatever's decided).
2. Add `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY` (or equivalent) as **environment-scoped** GitHub secrets — separately for `staging` and `production`, so each points at its own host.
3. Replace the placeholder `run: echo ...` step in each job with an actual deploy action (an `appleboy/ssh-action` block pulling the new image and running `docker compose up -d` is sketched out in the README's CI/CD section — copy-paste ready, just needs real secret names filled in).
4. Nothing else in the pipeline changes — the gate order (tests must pass → image must build → staging must succeed → production needs a human click) stays exactly as-is.

**Extending the pipeline further**, in likely order of usefulness:
- **Unit tests**, once they exist (§4a) — add as a job between `build-and-typecheck` and `regression-tests` so a cheap, fast failure blocks before the slower Playwright run even starts.
- **Full cross-browser matrix in CI** — add a Windows or macOS runner (or install Edge on the Linux runner) so `--project=edge` isn't Chromium-only there too.
- **Automated rollback** — if a production deploy step fails health checks, redeploy the previous image tag automatically rather than leaving it to a human.
- **Slack/Teams notification** on pipeline failure or on a successful production deploy.

---

## 6. Containerization — current state and what's next

Already built (see README's "Containerization (Docker)" for the step-by-step):

- **`Dockerfile`** — 3-stage build (install deps → build → pruned production runtime). Runs as non-root. Exposes `8080` (HTTP/redirect) and `4443` (HTTPS).
- **`docker-compose.yml`** — one command (`docker compose up --build`) builds and runs it, with the data volume and a certs bind-mount already wired up.
- **HTTPS is opportunistic**: mount a cert at `certs/` (generate one with `npm run certs:generate`) and the container serves HTTPS + an HTTP→HTTPS redirect on two ports; omit it and it's HTTP-only on one port. No code change needed either way — same image.
- **Data persistence**: a named volume (`simplehelpdesk-data`) survives container recreation; without it, every recreated container starts from the two seeded demo accounts again (see §2, point 2 — this is exactly the kind of accidental reset to avoid, just at the container-lifecycle level instead of a stray `rm`).

**What's realistically next, in likely priority order:**
1. **A real database.** The repository-interface seam (§2, point 1) means this is the single highest-leverage change — it removes the entire "shared JSON file" class of problem (single point of failure, no concurrent-write safety across multiple container replicas, no real backup story).
2. **Multi-replica readiness.** Right now the app can only ever run as one instance because sessions are in-memory (`server/src/middleware/session.ts`) and data is a single local file with an in-process write lock — neither survives or coordinates across replicas. Fixing this requires an external session store (Redis, or a signed JWT instead of a server-side session) *and* the real-database migration above.
3. **A managed secrets story for HTTPS certs** — right now certs are a manually-generated, manually-mounted local file. In a real deployment, that becomes a cert-manager/Let's Encrypt/load-balancer-terminated-TLS setup instead of `npm run certs:generate`.
4. **Health check endpoint** (`GET /healthz` or similar) — nothing currently exists for an orchestrator (Docker Compose's `healthcheck:`, Kubernetes liveness/readiness probes) to poll; `docker compose ps` today can only tell you the process is running, not that it's actually serving traffic correctly.
5. **Structured logging** — current output is plain `console.log`/`console.warn` lines to stdout. Fine for `docker compose logs`, but a real deployment behind a log aggregator (CloudWatch, Loki, ELK) benefits from structured JSON logs with request IDs.

---

## 7. Document map — where to go for more detail

| Question | Go to |
|---|---|
| "How do I run this locally?" / "Which URL do I open?" | [README — URLs at a glance](../README.md#urls-at-a-glance--which-one-do-i-open) |
| "How does HTTPS actually work here?" | [README — Running over HTTPS](../README.md#running-over-https) |
| "How do I build/run the Docker image?" | [README — Containerization (Docker)](../README.md#containerization-docker) |
| "What does the CI/CD pipeline actually run, stage by stage?" | [README — CI/CD Pipeline](../README.md#cicd-pipeline) |
| "Exactly which test cases exist, and what does each one assert?" | [README — QA Testing](../README.md#qa-testing-playwright) and the full narrative in [docs/qa-testing.md](qa-testing.md) |
| "If I change X, which tests must still pass / do I need a new one?" | [README — Regression testing policy & impact matrix](../README.md#regression-testing-policy--impact-matrix) |
| "What's the story behind a specific design decision (e.g. the port split, the two-way ticket model)?" | This document, §2 and §3 — each point names the file(s) involved |
