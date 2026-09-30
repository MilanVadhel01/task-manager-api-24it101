# context.md — AI Agent Codebase Context

## 1. Project Overview

A beginner-friendly REST API for managing tasks (CRUD), built as a college practical (Practical 5) with Node.js, Express, and MongoDB via Mongoose. It replaces an earlier in-memory version (Practical 4). Intended audience is students learning backend development.

Extended by **Practical 9** (server-side caching with node-cache) and **Practical 10** (asynchronous event-driven notifications using Node's built-in `events` module — no new npm packages).

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

- **Language:** JavaScript (CommonJS — `require` / `module.exports`)
- **Database:** MongoDB Atlas (cloud-hosted)
- **No TypeScript, no ESM, no test framework, no linter/formatter configured.**

## 3. Architecture

```
project-root/
├── models/
│   └── Task.js           # Mongoose schema, model, pre-save hook
├── cache.js              # Shared NodeCache instance (60s TTL) — Practical 9
├── events.js             # Shared EventEmitter instance — Practical 10
├── listeners.js          # task-created / task-deleted / error listeners — Practical 10
├── compare.js            # EDA vs non-EDA response-time demo (node compare.js) — Practical 10
├── server.js             # Express app: middleware, routes, caching, DB connect, error handler
├── .env                  # MONGO_URI (git-ignored)
├── .env.example          # Template for .env
├── .gitignore            # Ignores node_modules/, .env
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

### Data flow (with caching — Practical 9)

```
Client → CORS → JSON parser → Logger → Route handler
                                           ├─ cache HIT → return cached JSON (no DB query)
                                           └─ cache MISS → Mongoose → MongoDB Atlas → cache.set() → JSON
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
| Syntax check | `node --check server.js` (also events.js, listeners.js, compare.js) |
| Run tests | _None configured_ |
| Dev server (watch) | _None configured_ (no `nodemon` — **assumption**: add `nodemon` as a devDep if needed) |
| Lint / Format | _None configured_ |
| Build | _N/A — no build step_ |

### First-time setup

1. `npm install`
2. `copy .env.example .env` — then fill in a valid `MONGO_URI`
3. `npm start` — server listens on **port 5000**

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB Atlas connection string |

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
| `server.js` | **Entire application** — middleware stack, all 5 CRUD routes + cache logic + debug endpoint, event emits, DB connection, error handler, server startup |
| `cache.js` | Shared `NodeCache` instance (60s TTL) — imported by `server.js` for route-level caching |
| `events.js` | Shared `TaskEvents` emitter instance (extends `EventEmitter`) — Practical 10 |
| `listeners.js` | Registers `task-created`, `task-deleted`, `error` listeners on the shared emitter — Practical 10 |
| `compare.js` | Standalone demo comparing response times with vs without EDA (`node compare.js`) — Practical 10 |
| `models/Task.js` | Mongoose schema (5 fields), pre-save title-trim hook, model export |
| `.env` | Holds `MONGO_URI` — **never commit** |
| `.env.example` | Template showing expected env var shape |
| `package.json` | Only script is `start`; 5 production deps; no devDeps |

## 7. Gotchas

- **Port is hardcoded.** `const PORT = 5000;` is not read from `.env`. Changing the port requires editing `server.js`.
- **No `nodemon` / watch mode.** The server must be manually restarted after code changes.
- **DB connects at module load.** `mongoose.connect()` fires immediately on `require('./server')`. On failure it calls `process.exit(1)` — there is no graceful retry.
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

## 8. Out of Scope

- **`node_modules/`** — auto-generated; never edit.
- **`package-lock.json`** — auto-generated; don't manually edit; let `npm install` regenerate it.
- **`.env`** — contains real credentials; never commit or share.
- **No deployment config exists** (no Dockerfile, no CI/CD, no Procfile). Deployment is not part of this practical.
