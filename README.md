# 📝 Task Manager API — Practical 5

[![CI Pipeline](https://github.com/MilanVadhel01/task-manager-api-24it101/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/MilanVadhel01/task-manager-api-24it101/actions/workflows/ci.yml)

A beginner-friendly **REST API** built with **Node.js**, **Express.js**, and **MongoDB (Mongoose)**.  
This project replaces the Practical 4 in-memory storage with a real MongoDB database.

> ⚡ Extended in later practicals: **Practical 9** adds server-side caching with `node-cache`, and **Practical 10** adds asynchronous event-driven notifications using Node's built-in `events` module.
>
> 🐳 **Practical 11:** the API is **containerized with Docker**. This repo gained a
> `Dockerfile` (node:22-alpine, production deps only) and a `.dockerignore` that keeps
> the real `.env` out of the image. The API is started by the `docker-compose.yml`
> located in the *frontend* repo (`portfolio-24it101`), which builds this backend from
> its sibling directory and supplies `MONGO_URI=mongodb://mongodb:27017/taskdb` at
> runtime. Your local `.env` / Atlas setup still works for non-Docker development.
>
> ⚙️ **Practical 12:** a **GitHub Actions CI pipeline** (`.github/workflows/ci.yml`)
> installs dependencies and runs **Jest + Supertest** tests against a MongoDB service
> container on every push to `main`. See [Continuous Integration](#-continuous-integration).
>
> 🤖 **Practical 13:** the API integrates **OpenRouter** (via the official `openai` SDK)
> so the frontend can request an **AI-generated task description** from a task title.
> See [AI Integration](#-ai-integration--practical-13).

---

## 🚀 Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | Runtime environment |
| Express.js | Web framework |
| MongoDB | NoSQL database |
| Mongoose | MongoDB ODM (Object Data Modelling) |
| dotenv | Load environment variables from `.env` |
| node-cache | Server-side in-memory caching (Practical 9) |
| events (Node built-in) | Event-driven async notifications (Practical 10) |
| Docker | Container image for the API (Practical 11) |
| Docker Compose | Orchestrates API + frontend + MongoDB (Practical 11) |
| Jest | Automated test runner (Practical 12) |
| Supertest | HTTP assertions against the Express API (Practical 12) |
| GitHub Actions | CI pipeline: install dependencies + run tests (Practical 12) |
| openai (SDK) | OpenAI-compatible client pointed at OpenRouter (Practical 13) |
| OpenRouter | Free AI model API used for task descriptions (Practical 13) |

---

## 📁 Project Structure

```
practical-task-api/
├── models/
│   └── Task.js          # Mongoose schema & model
├── tests/
│   └── tasks.test.js    # Jest + Supertest API tests (Practical 12)
├── cache.js             # Shared node-cache instance, 60s TTL (Practical 9)
├── events.js            # Shared EventEmitter instance (Practical 10)
├── listeners.js         # task-created / task-deleted / error listeners (Practical 10)
├── compare.js           # EDA vs non-EDA response-time demo (Practical 10)
├── .env                 # Your MongoDB connection string (git-ignored, NOT copied into Docker)
├── .env.example         # Template for environment variables
├── .gitignore           # Ignores node_modules/ and .env
├── Dockerfile           # node:22-alpine image — /app, npm ci --omit=dev, EXPOSE 5000 (P11)
├── .dockerignore        # Keeps .env, node_modules/, .git/ out of the image (P11)
├── .github/
│   └── workflows/
│       └── ci.yml       # GitHub Actions CI pipeline (Practical 12)
├── package.json         # Project metadata & dependencies
├── package-lock.json    # Locked dependency versions
└── server.js            # Main Express application
```

---

## ⚙️ Setup & Installation

### 🐳 Option A — Docker (Practical 11)

No local Node or MongoDB setup needed. The Compose file lives in the **frontend** repo:

```bash
cd ../portfolio-24it101
docker compose up --build     # API on http://localhost:5000
```

No `.env` is required in Docker mode — Compose injects
`MONGO_URI=mongodb://mongodb:27017/taskdb` (see [Practical 11](#-practical-11--containerization-docker) below).

### Option B — Manual (original workflow, uses MongoDB Atlas)

#### 1. Clone the repository

```bash
git clone https://github.com/MilanVadhel01/task-manager-api-24it101.git
cd task-manager-api-24it101
```

#### 2. Install dependencies

```bash
npm install
```

#### 3. Configure environment variables

Create a `.env` file in the root directory:

```bash
copy .env.example .env
```

Then open `.env` and fill in your MongoDB Atlas connection string:

```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/taskdb?retryWrites=true&w=majority
```

Add the AI settings as well (see [AI Integration](#-ai-integration--practical-13) for
how to get a free key):

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=openrouter/free
```

The API works without these values — the AI route then returns its fallback message —
but the **Generate Description** feature needs them.

#### 4. Start the server

```bash
npm start
```

You should see:
```
🚀 Server is running on port 5000
✅ Connected to MongoDB successfully
```

---

## 🌐 Connecting MongoDB Atlas

1. Go to [https://cloud.mongodb.com](https://cloud.mongodb.com) and sign in
2. Create a free **M0 cluster**
3. Under **Database Access** → create a user with Read & Write permissions
4. Under **Network Access** → add `0.0.0.0/0` (allow all IPs)
5. Click **Connect → Drivers** → copy the connection string
6. Paste it into your `.env` file as `MONGO_URI`

---

## 🗂️ Task Schema

| Field | Type | Required | Default |
|---|---|---|---|
| `title` | String | ✅ Yes | — |
| `description` | String | No | — |
| `completed` | Boolean | No | `false` |
| `createdAt` | Date | No | `Date.now` |
| `priority` | String (enum) | No | `"low"` |

**Priority allowed values:** `low` · `medium` · `high`

> **Pre-save hook:** Whitespace is automatically trimmed from `title` before saving.

---

## 📡 API Endpoints

### GET `/tasks`
Returns all tasks.

**Response `200`:**
```json
[
  {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "title": "Buy groceries",
    "description": "Milk, eggs, bread",
    "completed": false,
    "priority": "medium",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

---

### GET `/tasks/:id`
Returns a single task by ID.

**Response `200`:** Task object  
**Response `404`:**
```json
{ "error": "Task not found" }
```

---

### POST `/tasks`
Creates a new task.

**Request Body:**
```json
{
  "title": "Complete assignment",
  "description": "Finish Practical 5",
  "priority": "high"
}
```

**Response `201`:** Created task object  
**Response `400`** (validation error):
```json
{ "error": "Title is required" }
```

---

### PUT `/tasks/:id`
Updates an existing task by ID.

**Request Body** (any fields to update):
```json
{
  "completed": true,
  "priority": "low"
}
```

**Response `200`:** Updated task object  
**Response `404`:**
```json
{ "error": "Task not found" }
```

---

### DELETE `/tasks/:id`
Deletes a task by ID.

**Response `200`:**
```json
{ "message": "Task successfully deleted" }
```

**Response `404`:**
```json
{ "error": "Task not found" }
```

---

## 🧪 Sample Postman Requests

| # | Method | URL | Body |
|---|---|---|---|
| 1 | GET | `http://localhost:5000/tasks` | — |
| 2 | GET | `http://localhost:5000/tasks/:id` | — |
| 3 | POST | `http://localhost:5000/tasks` | `{ "title": "My Task", "priority": "high" }` |
| 4 | PUT | `http://localhost:5000/tasks/:id` | `{ "completed": true }` |
| 5 | DELETE | `http://localhost:5000/tasks/:id` | — |

---

## ✅ Supplementary Problems Implemented

| # | Feature | Details |
|---|---|---|
| 1 | `priority` field | Enum: `low`, `medium`, `high` — default: `low` |
| 2 | Pre-save hook | Auto-trims whitespace from `title` before every save |
| 3 | `GET /tasks/:id` | Returns single task or `404` if not found |

---

## 🧠 Practical 9 — Server-Side Caching

- `GET /tasks` and `GET /tasks/:id` check an in-memory **node-cache** (60s TTL) before querying MongoDB
- Cache hits return instantly without touching the database (`📦 Cache HIT` in the console)
- All write routes (POST / PUT / DELETE) invalidate the cache so the next GET is fresh
- `GET /debug/cache-stats` exposes `{ hits, misses, currentKeys, keyCount }`

---

## ⚡ Practical 10 — Asynchronous Processing (Event-Driven Architecture)

POST and DELETE routes no longer do their "extra work" inline. After the HTTP response
is sent, they **emit events** on a shared emitter, and registered listeners handle the
rest asynchronously — so slow post-processing never delays the API response.

### New files

| File | Purpose |
|---|---|
| `events.js` | Exports one shared `TaskEvents` (extends Node's `EventEmitter`) instance |
| `listeners.js` | Registers `task-created`, `task-deleted` and `error` listeners once at startup |
| `compare.js` | Demo comparing response times with vs without EDA (`node compare.js`) |

### How it works

```
POST /tasks ──► save to DB ──► invalidate cache ──► log [API] ──► res.status(201).json() ──► emit('task-created')
                                                                                        └─► listener: log start ──► (2s async delay) ──► notification + completion log
```

- `emit()` always happens **after** the response is sent
- The `task-created` listener simulates a slow handler (`SIMULATED_DELAY_MS = 2000`), with try/catch **inside** the `setTimeout` callback so async errors are forwarded to the `error` listener instead of crashing the server
- The `error` listener is registered with `.on()`, so an emitted `error` never crashes the server

### Expected console output after `POST /tasks`

```
[API] Response sent at 2026-09-30T12:00:00.000Z          ← response sent first
[Listener] task-created started at 2026-09-30T12:00:00.001Z
    ... ~2s gap (client already has the response) ...
[Notification] Task "X" created at 2026-09-30T12:00:02.001Z | assigned to: Unassigned
[Listener] task-created completed at 2026-09-30T12:00:02.002Z
```

After a successful `DELETE /tasks/:id`: `[Notification] Task "X" deleted at <ISO>`

> **Note:** The Task schema has no `assignedUser` field, so notifications fall back to `Unassigned`.

### Run the timing comparison

```bash
node compare.js
```

Sample result:

```
Without EDA (inline) — avg response time: 6006 ms
With EDA (events)    — avg response time: 0 ms
```

---

## 📊 HTTP Status Codes Used

| Code | Meaning |
|---|---|
| `200` | OK — request succeeded |
| `201` | Created — new resource created |
| `400` | Bad Request — validation error |
| `404` | Not Found — resource doesn't exist |
| `500` | Internal Server Error — something went wrong |

---

## 🐳 Practical 11 — Containerization (Docker)

The API runs as a Docker container orchestrated together with the React frontend
and a MongoDB server by **Docker Compose**. The Compose file lives in the
*frontend* repository (`portfolio-24it101/docker-compose.yml`) and builds this
backend from its **sibling directory**:

```yaml
backend:
  build:
    context: ../task-manager-api-24it101   # this repo
    dockerfile: Dockerfile
```

The two Git repositories remain separate.

### Files added in this practical

| File | Purpose |
|---|---|
| `Dockerfile` | `node:22-alpine` image → `/app`, `npm ci --omit=dev`, copies source, `EXPOSE 5000`, `npm start` |
| `.dockerignore` | Excludes `node_modules/`, **`.env`**, `.git/`, logs, `context.md` from the build context |

### How configuration works inside the container

1. The image does **not** contain `.env` — `.dockerignore` blocks it, so Atlas
   credentials never end up in an image layer.
2. `docker-compose.yml` sets the environment variable for the container:
   ```yaml
   environment:
     MONGO_URI: mongodb://mongodb:27017/taskdb
   ```
3. `require('dotenv').config()` loads `.env` **only if present** and never
   overwrites variables that already exist in the environment — so the
   Compose-provided URI wins *inside the container*, while your local
   `.env` (Atlas) is untouched for `npm start` on your machine.

**Why `mongodb` and not `localhost`?** In Docker, each container is its own
machine. MongoDB runs in a *different* container, reachable by its **service
name** `mongodb` on the `app-network` bridge network. `localhost` inside the
backend container would mean the backend container itself — where no database
is running. (The frontend is the opposite case: the *browser* runs on the host,
so it keeps using `http://localhost:5000`.)

### Dockerfile `EXPOSE` vs Compose `ports`

- `EXPOSE 5000` — documentation only; tells Docker which port the app listens
  on. **Nothing is reachable from your machine because of it.**
- `ports: "5000:5000"` in `docker-compose.yml` — actually forwards the host
  port to the container (`HOST:CONTAINER`), which is what makes
  `http://localhost:5000/tasks` work from your browser/Postman.

### Why host `node_modules` is not copied

The host's `node_modules` is built for your OS (Windows `.node` binaries) and
adds thousands of files to the build context. The Dockerfile installs the
lockfile versions itself with `npm ci --omit=dev` (production deps only),
giving a small, reproducible Linux install.

### Running the stack

```bash
# All commands run from the FRONTEND repo — the Compose file lives there
cd ../portfolio-24it101

docker compose up --build        # build + start frontend, backend, mongodb
docker compose ps                # check statuses
docker compose logs -f backend   # watch API logs (cache HIT/MISS, events)
docker compose down              # stop (mongo_data volume is kept)
```

Verify:

```bash
curl http://localhost:5000/tasks           # CRUD API
curl http://localhost:5000/debug/cache-stats   # Practical 9 cache stats
docker compose exec backend printenv MONGO_URI # → mongodb://mongodb:27017/taskdb
```

### What still works in containers

- Full CRUD API (`GET/POST/PUT/DELETE /tasks`)
- Practical 9 caching — watch `📦 Cache HIT` / `🔍 Cache MISS` in
  `docker compose logs backend`, stats at `GET /debug/cache-stats`
- Practical 10 event-driven notifications — `docker compose logs backend`
  after a `POST /tasks` shows `[Listener] task-created started` and the
  `[Notification] ...` ~2 s later, *after* the HTTP response was sent
- Task data persists across restarts thanks to the `mongo_data` named volume

### Troubleshooting

| Symptom | Fix |
|---|---|
| `MongoDB connection failed` on start | `docker compose ps` — mongodb must be *healthy*; check `docker compose logs mongodb` |
| `port 5000 already allocated` | A local `npm start` instance is running — stop it first |
| Want a clean slate for data | `docker compose down -v` (⚠️ deletes the `mongo_data` volume) |
| Changed source code | `docker compose up --build` |

---

## 🔄 Continuous Integration

**Continuous Integration (CI)** means automatically integrating and validating every code
change: a machine checks out the code, installs it, and runs the test suite, so problems
are caught immediately instead of at submission time.

**Continuous Deployment (CD)** goes one step further — validated code is deployed
automatically. This practical demonstrates **CI only**: the workflow installs
dependencies and runs automated tests; it does **not** deploy the application.

### The workflow

The pipeline lives at `.github/workflows/ci.yml`, is named **CI Pipeline**, and runs
automatically on every push to the `main` branch.

| Stage | What happens |
|---|---|
| Checkout | `actions/checkout@v4` downloads the repository into the runner |
| Node setup | `actions/setup-node@v4` installs Node.js **22** (the project's runtime) and caches npm downloads |
| MongoDB | GitHub starts a `mongo:7.0` **service container** on port `27017`; a health check (`db.runCommand({ ping: 1 })`) makes the job wait until the database responds |
| Install | `npm install` installs dependencies from `package.json` / `package-lock.json` |
| Test | `npm test` runs `jest --runInBand`; **Supertest** sends real HTTP requests to the exported Express app without opening a port |

The job is called `build-and-test` and runs on `ubuntu-latest`.

### Database used in CI

The tests never touch real application data. The workflow sets:

```yaml
env:
  MONGO_TEST_URI: mongodb://127.0.0.1:27017/taskdb_test
```

so the suite connects to the throwaway `taskdb_test` database inside the MongoDB service
container. No MongoDB Atlas credentials are used in CI, and no secrets are stored in the
repository.

### Automated tests

| Test | What it verifies |
|---|---|
| `GET /tasks` | Returns `200`, an array, and the real Task document shape (`_id`, `title`, `description`, `completed`, `priority`, `createdAt`) |
| `GET /tasks/:id` (missing id) | Returns `404` with the real error body `{ "error": "Task not found" }` for a valid but nonexistent ObjectId |

`tests/tasks.test.js` connects to the test database before the suite, deletes test
records and flushes the `node-cache` between tests, and closes the Mongoose connection
at the end.

### Running the tests locally

```bash
npm install
npm test
```

Local runs use `MONGO_TEST_URI` when it is set and otherwise fall back to
`mongodb://127.0.0.1:27017/taskdb_test`, so a local MongoDB must be running. Never point
`MONGO_TEST_URI` at your real database.

### Viewing results

Open the repository on GitHub → **Actions** tab → **CI Pipeline**. Every push to `main`
appears as a run: a green checkmark means the tests passed, a red X means a test failed.
Click the run → `build-and-test` → **Run automated tests** to read the Jest output.

### Status badge

The badge at the top of this README always shows the latest `main` run:

```markdown
[![CI Pipeline](https://github.com/MilanVadhel01/task-manager-api-24it101/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/MilanVadhel01/task-manager-api-24it101/actions/workflows/ci.yml)
```

---

## 🤖 AI Integration — Practical 13

### Purpose

The **Generate Description** button in the task creation form turns a task title into a
short, professional description suggestion. The suggestion is inserted into the existing
description textarea as **editable text** — it is never saved automatically. The user must
still review it and submit the normal task form.

### OpenRouter integration

The backend uses the official `openai` npm package against OpenRouter's
OpenAI-compatible endpoint. The client is created once in `server.js`:

```js
const OpenAI = require('openai');

const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    timeout: 20000,   // stop waiting after 20 seconds
    maxRetries: 0     // the route retries once itself — protects the free quota
});
```

The key is read from the environment; if it is missing, no client is created and the
route immediately returns its graceful fallback.

Each request uses **chat completions** with:

- a **system message** describing the job (2–4 sentence professional description, no markdown)
- **only the trimmed task title** as the user message
- `temperature: 0.6`
- `max_tokens: 1000`
- the model from `process.env.OPENROUTER_MODEL` (default `openrouter/free`)

The model name is never hardcoded in the request logic, so the free model can be changed
in `.env` without touching any code.

> **Why `max_tokens` is 1000 and not 160:** `openrouter/free` is an auto-router that picks
a different free model per request, and many free models are *reasoning* models. With a
160-token budget they spend every token on hidden reasoning, finish with
`finish_reason: "length"` and return **no text at all** — which surfaced as the
"temporarily unavailable" fallback on most clicks. The route now allows enough tokens for
thinking plus the answer, waits up to 20s (slow free models), and retries **once** with a
freshly routed model if the first attempt returns nothing or times out. Longer results are
trimmed to 600 characters on a sentence boundary.

### API endpoint

`POST /api/ai/generate-description`

**Request:**

```json
{
  "title": "Complete Machine Learning practical"
}
```

An optional `taskId` may be sent for an existing task; it is only used for rate limiting.

**Success `200`:**

```json
{
  "description": "Complete the assigned Machine Learning practical exercises, implement the required algorithms, execute the experiments and document the results.",
  "fallback": false
}
```

**Validation error `400`:**

```json
{ "error": "Title is required" }
```

Titles longer than **150 characters** are rejected with a `400` as well.

**Rate limited `429`:**

```json
{
  "description": "",
  "fallback": true,
  "message": "Please wait 42 seconds before generating another description for this task.",
  "retryAfterSeconds": 42
}
```

**AI unavailable `200` (graceful fallback):**

```json
{
  "description": "",
  "fallback": true,
  "message": "AI suggestions are temporarily unavailable. Please enter your task description manually."
}
```

Two other failure messages are returned in the same `fallback: true` shape, so the user can
tell what actually happened:

| Situation | `message` |
|---|---|
| Free-model daily quota used up (`429 ... free-models-per-day`) | *The free AI quota for today is used up. Please enter your task description manually, or try again tomorrow.* |
| Provider rate-limiting (`429`) | *The AI provider is busy right now. Please try again in a moment, or enter the description manually.* |
| Timeout, bad key, network or empty completion | *AI suggestions are temporarily unavailable. Please enter your task description manually.* |

A `429` is not retried (it cannot clear within a retry). A failed generation also releases
the 60-second rate-limit slot, so clicking **Generate** again works immediately instead of
making the user wait out the cooldown.

> **Free-tier limit:** a free OpenRouter account gets **50 free-model requests per day**
(`GET https://openrouter.ai/api/v1/key` → `free_model_daily_requests`). Each suggestion uses
one or two, so the route can stop working near the end of a testing day. The count resets
daily; adding credit to the account raises it to 1000/day.

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | For AI features | Free OpenRouter key — **backend only**, never sent to the browser |
| `OPENROUTER_MODEL` | No | Model name, default `openrouter/free` |

`MONGO_URI` (and `MONGO_TEST_URI` for tests) are unchanged.

**Getting a free key:**

1. Sign in at [openrouter.ai](https://openrouter.ai)
2. Open **Keys** → **Create Key**
3. Copy the key into the backend `.env`:

```env
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=openrouter/free
```

4. Restart the server (`npm start`). Never commit `.env` — it is ignored by `.gitignore`
   and excluded from Docker images by `.dockerignore`.

### How the frontend talks to the backend

```
React (Generate Description)
  → src/api.js generateTaskDescription(title)
  → POST http://localhost:5000/api/ai/generate-description
  → Express route (server.js)
  → OpenRouter /chat/completions
  → description returned to React → inserted into the description textarea
```

While the request is running the button shows **Generating...** and is disabled; it is also
disabled when the title is empty. On success the textarea is filled (still editable) and the
disclaimer **“AI-generated suggestion. Please review and edit before saving.”** appears.

### Graceful fallback

A missing API key, network failure, invalid key, unavailable model, empty completion or
timeout all produce a controlled `fallback: true` response with status `200` (quota and
rate-limit errors return the clearer messages listed above). The server logs a short reason
server-side, but provider details and credentials are never sent to the browser. The Express
server keeps running and all task CRUD routes keep working, so the AI feature is never
required to create a task.

### Rate limiting

To protect the free quota, the route allows **one AI generation per task per minute**:

- Existing task → key uses its `taskId`
- New task → key uses the client IP + lower-cased, trimmed title

A `Map` of timestamps is stored **in memory** in the backend process. Repeating a request
within 60 seconds returns `429` with a clear “Please wait N seconds…” message and never
calls OpenRouter. Because the state is in memory, it resets on server restart and is not
shared between multiple server instances.

### Responsible AI and privacy

- Only the **task title** is sent to OpenRouter — no credentials, tokens, passwords,
  database connection strings or other task metadata.
- The API key lives exclusively in the backend `.env`; it is never placed in a `VITE_`
  variable, the React bundle, or browser requests.
- Generated text is a **suggestion, not a fact**: it may be inaccurate or generic. The UI
  asks the user to review and edit it before saving, and AI output is never saved
  automatically.
- Task titles are transmitted to an external AI provider when the button is used.

### Running it

```bash
npm install
npm start          # API on http://localhost:5000
```
The frontend runs separately (`cd ../portfolio-24it101 && npm run dev`). In Docker mode the
Compose file passes the backend `.env` to the container at runtime (`env_file`), so the same
key works inside Docker without being baked into any image.

### Tests

`tests/ai.test.js` mocks the `openai` package, so the AI tests never call OpenRouter and
never consume quota. `tests/ai-no-key.test.js` verifies the missing-key fallback.

```bash
npm test
```

---

## 👤 Author

**Milan Vadhel**  
GitHub: [@MilanVadhel01](https://github.com/MilanVadhel01)
