# context.md — AI Agent Codebase Context

## 1. Project Overview

A beginner-friendly REST API for managing tasks (CRUD), built as a college practical (Practical 5) with Node.js, Express, and MongoDB via Mongoose. It replaces an earlier in-memory version (Practical 4). Intended audience is students learning backend development.

Extended by **Practical 9** (server-side caching with node-cache) and **Practical 10** (asynchronous event-driven notifications using Node's built-in `events` module — no new npm packages).

Containerized by **Practical 11**: this repo has a `Dockerfile` + `.dockerignore`; the `docker-compose.yml` lives in the frontend repo (`portfolio-24it101`) and builds this backend from its sibling directory alongside `mongo:7.0` on the `app-network` bridge network with a `mongo_data` volume.

**Practical 12** added the automated test suite (`tests/`, Jest + Supertest against a dedicated `taskdb_test` database). To make the app testable, `server.js` no longer connects/listens on import: the DB connect + `listen` moved into `startServer()`, which only runs when `require.main === module`, and the file now does `module.exports = app`.

**Practical 13** added AI task-description generation: `POST /api/ai/generate-description` calls OpenRouter through the official `openai` SDK. The API key lives only in the backend `.env` (never in the frontend, never in an image); a missing key, timeout, empty completion, quota error or provider failure all return the same controlled `fallback: true` response with status `200`, so task CRUD never depends on the AI feature.

## 2. Tech Stack

| Dependency | Version | Purpose |
|---|---|---|
| Node.js | (see runtime) | JavaScript runtime |
| Express | ^4.22.2 | HTTP framework |
| Mongoose | ^9.9.1 | MongoDB ODM |
| dotenv | ^16.4.5 | Load `.env` into `process.env` |
| cors | ^2.8.6 | Cross-origin request middleware |
| node-cache | (latest) | In-memory caching with TTL (Practical 9) |
| events | Node built-in | Event emitter for async task notifications (Practical 10 — no npm install needed) |
| openai | ^7.45.1 | Official SDK, pointed at OpenRouter's base URL (Practical 13) |
| jest | ^30.5.2 (dev) | Test runner (Practical 12) |
| supertest | ^7.3.1 (dev) | HTTP assertions against the exported app (Practical 12) |

- **Language:** JavaScript (CommonJS — `require` / `module.exports`)
- **Database:** MongoDB Atlas (cloud) for local manual runs; Compose-managed `mongo:7.0` container (`mongodb://mongodb:27017/taskdb`) when started with Docker (Practical 11); a separate `taskdb_test` database for the test suite (Practical 12)
- **External service:** OpenRouter (`https://openrouter.ai/api/v1`) — free-tier AI models, optional (Practical 13)
- **No TypeScript, no ESM, no linter/formatter configured.** Tests exist (Jest), configured inline in `package.json`.

## 3. Architecture

```
project-root/
├── models/
│   └── Task.js           # Mongoose schema, model, pre-save hook
├── cache.js              # Shared NodeCache instance (60s TTL) — Practical 9
├── events.js             # Shared EventEmitter instance — Practical 10
├── listeners.js          # task-created / task-deleted / error listeners — Practical 10
├── compare.js            # EDA vs non-EDA response-time demo (node compare.js) — Practical 10
├── tests/
│   ├── tasks.test.js     # CRUD + caching tests on taskdb_test — Practical 12
│   ├── ai.test.js        # AI route tests, OpenAI SDK mocked (no quota used) — Practical 13
│   └── ai-no-key.test.js # Missing-key fallback test — Practical 13
├── server.js             # Express app: middleware, CRUD routes, AI route, caching, error handler, startServer()
├── .env                  # MONGO_URI + OPENROUTER_API_KEY/MODEL (git-ignored)
├── .env.example          # Template for .env
├── .gitignore            # Ignores node_modules/, .env
├── Dockerfile            # node:22-alpine API image, EXPOSE 5000 (Practical 11)
├── .dockerignore         # Keeps .env, node_modules/, .git/ out of image (Practical 11)
├── .github/
│   └── workflows/
│       └── ci.yml        # "CI Pipeline": npm install + npm test on every push to main (Practical 12)
├── package.json          # Scripts, deps, metadata
└── README.md             # Setup guide & API docs
```

### How things connect

1. `server.js` loads env vars via `dotenv`, then connects to MongoDB using `MONGO_URI`.
2. All routes are defined inline in `server.js` (no separate router files).
3. Routes use the `Task` model from `models/Task.js` for all DB operations.
4. `cache.js` exports a shared `NodeCache` instance imported by `server.js`.
5. Middleware order: `cors()` → `express.json()` → request logger → routes → debug endpoint → global error handler.
6. `server.js` requires `./events` (shared emitter) and `./listeners` (registers all listeners once at startup, before any emit).
7. POST and DELETE routes emit `task-created` / `task-deleted` **after** sending the HTTP response; listeners do the slow work asynchronously (Practical 10).
8. **Docker (Practical 11):** Compose sets `MONGO_URI` as a container env var, so `dotenv` (which never overwrites existing env vars) uses it even though no `.env` file exists in the image. Containers reach each other by service name on `app-network` — the backend connects to host `mongodb`, never `localhost`. Compose also passes the repo's real `.env` through an optional `env_file` (P13) so `OPENROUTER_*` reaches the container; the key is still never baked into the image.
9. **AI route (Practical 13):** `POST /api/ai/generate-description` validates and rate-limits the title, then calls OpenRouter with only that title. Two attempts at most; a `429` breaks out immediately. The generated text is trimmed to 600 characters on a sentence boundary and returned as `{ description, fallback: false }`.

### Data flow (with caching — Practical 9)

```
Client → CORS → JSON parser → Logger → Route handler
                                           ├─ cache HIT → return cached JSON (no DB query)
                                           └─ cache MISS → Mongoose → MongoDB (Atlas, or the Compose `mongodb` container) → cache.set() → JSON
                                           ↓ (on write: POST/PUT/DELETE)
                                        cache.del('all_tasks') + cache.del('task_{id}') → invalidate
                                           ↓ (on error)
                                        Global error handler → 500 JSON response
```

### Event-driven flow (Practical 10)

```
POST /tasks: DB save → cache invalidation → [API] log → res.status(201).json(task) → emit('task-created', task)
DELETE /tasks/:id: DB delete → cache invalidation → res.status(200).json(...) → emit('task-deleted', deletedTask)
                                                                            ↓
listeners.js: task-created → log start → setTimeout(2000) → try/catch → notification + completion log
              task-deleted → immediate notification log
              error       → logs message + timestamp (registered with .on(), so emit('error') never crashes the server)
```

## 4. Setup & Commands

| Action | Command |
|---|---|
| Install deps | `npm install` |
| Start server | `npm start` (runs `node server.js`) |
| EDA timing demo | `node compare.js` — compares inline vs event-driven response times |
| Run tests | `npm test` (`jest --runInBand`) — needs MongoDB at `127.0.0.1:27017` or a `MONGO_TEST_URI` |
| Syntax check | `node --check server.js` (also events.js, listeners.js, compare.js) |
| Dev server (watch) | _None configured_ (no `nodemon` — **assumption**: add `nodemon` as a devDep if needed) |
| Lint / Format | _None configured_ |
| Build | _N/A — no build step_ |
| Start with Docker (P11) | `cd ../portfolio-24it101 && docker compose up --build` (Compose file lives in the frontend repo) |

### First-time setup

1. `npm install`
2. `copy .env.example .env` — then fill in a valid `MONGO_URI` (and `OPENROUTER_API_KEY` for the AI feature)
3. `npm start` — server listens on **port 5000**

For the test suite, MongoDB must be reachable: either a local `mongod` on `127.0.0.1:27017`, or set `MONGO_TEST_URI` in `.env` to point at any test database. The tests never touch `MONGO_URI`.

**Or skip all of it (Practical 11):** `cd ../portfolio-24it101 && docker compose up --build` — the container gets `MONGO_URI` from Compose and needs no `.env`.

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB Atlas connection string |
| `MONGO_TEST_URI` | No | Test database for Jest (default `mongodb://127.0.0.1:27017/taskdb_test`) — Practical 12 |
| `OPENROUTER_API_KEY` | No | OpenRouter key for AI descriptions; absent → the route returns its fallback (Practical 13) |
| `OPENROUTER_MODEL` | No | Model slug, default `openrouter/free` (an auto-router that picks a random free model per call) |

In Docker mode (Practical 11) `MONGO_URI` is supplied by `docker-compose.yml` (`mongodb://mongodb:27017/taskdb`) — no `.env` file is created or needed inside the container.

## 5. Conventions

### Naming & organization
- **Files:** PascalCase for models (`Task.js`), camelCase for everything else (`server.js`)
- **Routes:** all defined inline in `server.js`, not extracted into a `routes/` directory
- **Models:** one file per model in `models/`
- **Utilities:** shared modules (like `cache.js`) live in the project root

### Caching pattern (Practical 9)
- **Read-through cache** on `GET /tasks` — check `cache.get('all_tasks')` before querying MongoDB
- **Per-id cache** on `GET /tasks/:id` — cache key `task_{id}` for individual task lookups
- **Write-through invalidation** — all write routes (POST, PUT, DELETE) call `cache.del('all_tasks')` after a successful DB write; PUT and DELETE also invalidate `cache.del('task_{id}')`
- **TTL: 60 seconds** — cached entries auto-expire even without explicit invalidation
- **Debug endpoint** — `GET /debug/cache-stats` exposes `{ hits, misses, currentKeys, keyCount }`
- Console logs `📦 Cache HIT` / `🔍 Cache MISS` for observability

### Event-driven pattern (Practical 10)
- **Shared emitter:** `events.js` exports a single `new TaskEvents()` (extends Node's `EventEmitter`) — every module gets the same instance via `require`
- **Listeners registered once at startup:** `server.js` calls `require('./listeners')` before any route can emit, so `.on()` is always registered first
- **Response-first ordering:** `emit()` always comes AFTER `res.json(...)` — slow listener work never delays HTTP responses
- **Simulated slow handler:** `task-created` listener logs a start timestamp, then does its notification work inside `setTimeout` with `SIMULATED_DELAY_MS = 2000`, then logs a completion timestamp (sync vs async ordering visible in console)
- **Assigned user:** read from `task.assignedUser` with fallback `'Unassigned'` (schema intentionally unchanged)
- **Async error safety:** try/catch is INSIDE the `setTimeout` callback; errors are re-emitted as `'error'`, handled by the registered error listener so the server never crashes
- **Timing demo:** `compare.js` simulates 5 requests both ways — inline blocking vs EDA — printing avg response times (~6s vs ~0ms)

### Error handling pattern
- Route handlers use `async (req, res, next)` with `try/catch`
- Mongoose `ValidationError` is caught explicitly and returned as `400` with human-readable messages
- All other errors are forwarded to `next(err)` → caught by the global error handler → returns `500 { error: "Something went wrong" }`

### AI suggestion pattern (Practical 13)
- **One controlled shape:** `{ description: '', fallback: true, message }` for every failure, always with status `200` (except a `400` for a bad title and `429` for the rate limit). The frontend only has to check `fallback`.
- **Client created once at module load**, and only if `OPENROUTER_API_KEY` is set — a missing key never crashes startup.
- **`maxRetries: 0` on the SDK**, because the route does its own retry: `AI_MAX_ATTEMPTS = 2`. The router picks a different model each call, so a second attempt is genuinely useful.
- **`AI_MAX_TOKENS = 1000`, `AI_TIMEOUT_MS = 20000`.** A small budget (160) made `openrouter/free` fail ~5 times out of 6: many free models are reasoning models that spend the whole budget on hidden thinking and return empty content (`finish_reason: "length"`).
- **`429` is never retried** — it cannot clear within a retry — and is reported with a specific message: `free-models-per-day` → quota used up, otherwise "provider is busy".
- **Rate limit:** one request per `<ip>:<taskId|title>` per `AI_RATE_LIMIT_MS` (60s), stored in a `Map` with expired-entry cleanup. A *failed* generation deletes its stamp so the user can retry immediately.
- **Only the title is sent** to the provider; the key and provider details are never returned to the browser. Failures are logged as `[AI] …`.
- **Output trimmed to 600 chars** on a sentence boundary (`trimDescription`) because some free models ramble far past the requested 2–4 sentences.

### Testing pattern (Practical 12)
- **`server.js` exports the app**, so Supertest needs no listening server; `startServer()` (connect + listen) runs only under `require.main === module`.
- **Dedicated database:** `MONGO_TEST_URI` / `taskdb_test`, wiped in `beforeAll` and `afterEach` along with `cache.flushAll()`.
- **`--runInBand`** so suites share one process and one Mongo connection.
- **AI tests mock the SDK:** `jest.mock('openai')` + a `mockCreate` fn, with `OPENROUTER_API_KEY` set before `require('../server')`. They never call OpenRouter and never consume real quota.

### Response conventions
- Success: `200` (read/update/delete) or `201` (create) with JSON body
- Not found: `404 { error: "Task not found" }`
- Validation error: `400 { error: "<message>" }`
- Server error: `500 { error: "Something went wrong" }`

### Model conventions
- Schemas define custom error messages inline: `required: [true, 'Title is required']`
- Enums are plain arrays on the schema: `enum: ['low', 'medium', 'high']`
- Pre-save hooks use `async function` (not arrow functions — `this` binding matters)

### Code style (no linter enforced)
- 4-space indentation
- Single quotes for strings
- Semicolons used
- Heavy use of section-separator comments (`// ─────────`)
- Inline comments explaining every step (educational codebase)

## 6. Key Files

| File | Role |
|---|---|
| `server.js` | **Entire application** — middleware stack, all 5 CRUD routes + cache logic + debug endpoint, event emits, AI route (P13), error handler, `startServer()` |
| `tests/tasks.test.js` | Jest + Supertest CRUD/caching tests against `taskdb_test` (P12) |
| `tests/ai.test.js` | AI route tests — retry on empty completion, timeout retry, quota message, description trimming, rate limit, graceful fallback (P13) |
| `tests/ai-no-key.test.js` | Verifies the fallback when `OPENROUTER_API_KEY` is empty (P13) |
| `cache.js` | Shared `NodeCache` instance (60s TTL) — imported by `server.js` for route-level caching |
| `events.js` | Shared `TaskEvents` emitter instance (extends `EventEmitter`) — Practical 10 |
| `listeners.js` | Registers `task-created`, `task-deleted`, `error` listeners on the shared emitter — Practical 10 |
| `compare.js` | Standalone demo comparing response times with vs without EDA (`node compare.js`) — Practical 10 |
| `models/Task.js` | Mongoose schema (5 fields), pre-save title-trim hook, model export |
| `.env` | Holds `MONGO_URI` — **never commit** |
| `.env.example` | Template showing expected env var shape |
| `package.json` | Scripts `start` + `test`; Jest config (`testEnvironment: node`, `testTimeout: 20000`) |
| `Dockerfile` | API container image — node:22-alpine, `WORKDIR /app`, `npm ci --omit=dev`, `EXPOSE 5000` (Practical 11) |
| `.dockerignore` | Keeps `.env`, `node_modules/`, `.git/` out of the build context (Practical 11) |
| `.github/workflows/ci.yml` | CI Pipeline — Node 22 + `mongo:7.0` service container, sets `MONGO_TEST_URI`, runs `npm install` then `npm test` on push to `main` (Practical 12) |

## 7. Gotchas

- **Port is hardcoded.** `const PORT = 5000;` is not read from `.env`. Changing the port requires editing `server.js`.
- **DB connects at module load — no longer true (P12).** `mongoose.connect()` + `app.listen()` live in `startServer()`, called only when `server.js` is run directly. Importing the module (as the tests do) opens no port and never calls `process.exit(1)`.
- **No `nodemon` / watch mode.** The server must be manually restarted after code changes.
- **Pre-save hook doesn't run on `findByIdAndUpdate`.** The title-trim hook only fires on `.save()` and `.create()`. Updates via PUT won't trim the title. This is standard Mongoose behavior but may surprise contributors.
- **No input sanitization beyond Mongoose validation.** Extra/unknown fields in the request body are silently ignored by destructuring, but there's no explicit allowlist middleware.
- **No pagination.** `GET /tasks` returns _every_ task in the collection.
- **CORS is wide open.** `app.use(cors())` allows all origins — acceptable for dev, not for production.
- **No authentication or authorization.**
- **Cache is in-memory only.** Restarting the server clears the cache. Not shared across multiple server instances.
- **`/debug/cache-stats` has no auth.** Anyone can hit it — fine for dev, remove or protect before production.
- **Listeners are never removed.** `.on()` is called once at startup with no `.off()` anywhere — by design (fire-and-forget notifications); adding dynamic subscribe/unsubscribe would need extra work.
- **`task-created` listener work can silently fail logs.** Errors inside the `setTimeout` are forwarded to the `error` listener and logged, but nothing retries or persists them.
- **`compare.js` busy-waits on purpose.** The No-EDA half blocks the event loop with a spin loop to simulate a truly synchronous handler — don't reuse that pattern in real code.
- **No event delivery guarantee.** If the process crashes between `res.json()` and `emit()`, the notification is simply lost — acceptable for a teaching demo of EDA ordering.
- **Port 5000 conflicts with Docker.** A local `npm start` instance must be stopped before `docker compose up` can publish `5000:5000`.
- **In Docker, `localhost` is the container itself.** Use the Compose service name (`mongodb`) for DB connections; the frontend's browser-side `http://localhost:5000` is the opposite case (host machine).
- **`openrouter/free` returns empty content surprisingly often.** It auto-routes each call to a different free model, and reasoning models burn the token budget on hidden thinking. Symptom: `finish_reason: "length"` with `content` empty — which used to look like a random failure. Keep `AI_MAX_TOKENS` generous.
- **The free OpenRouter tier allows 50 requests/day.** When exhausted the provider answers `429 Rate limit exceeded: free-models-per-day`; check `GET https://openrouter.ai/api/v1/key` → `free_model_daily_requests`. Each suggestion uses 1–2 requests (one retry).
- **A `.env` change needs a container recreate.** `docker compose up -d --force-recreate backend` — a plain `restart` keeps the old container environment, so the new key never reaches the process.
- **The in-memory rate-limit map resets on restart** and is per-process — with multiple instances each one keeps its own timestamps.
- **AI tests must mock the SDK.** Without `jest.mock('openai')` they would hit the real OpenRouter endpoint and consume live free-tier quota.

## 8. Out of Scope

- **`node_modules/`** — auto-generated; never edit.
- **`package-lock.json`** — auto-generated; don't manually edit; let `npm install` regenerate it.
- **`.env`** — contains real credentials (`MONGO_URI`, `OPENROUTER_API_KEY`); never commit or share, never log the key, and never expose it to the frontend.
- **CI runs tests only** — `.github/workflows/ci.yml` (Practical 12) is a test pipeline, not a deployment. Practical 11 adds only local Docker/Compose tooling; deploying to a cloud platform is still out of scope.
- **`docker-compose.yml` lives in the frontend repo** — don't add a second Compose file here; the stack is defined once in `portfolio-24it101/`.
