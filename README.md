# 📝 Task Manager API — Practical 5

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

---

## 📁 Project Structure

```
practical-task-api/
├── models/
│   └── Task.js          # Mongoose schema & model
├── cache.js             # Shared node-cache instance, 60s TTL (Practical 9)
├── events.js            # Shared EventEmitter instance (Practical 10)
├── listeners.js         # task-created / task-deleted / error listeners (Practical 10)
├── compare.js           # EDA vs non-EDA response-time demo (Practical 10)
├── .env                 # Your MongoDB connection string (git-ignored, NOT copied into Docker)
├── .env.example         # Template for environment variables
├── .gitignore           # Ignores node_modules/ and .env
├── Dockerfile           # node:22-alpine image — /app, npm ci --omit=dev, EXPOSE 5000 (P11)
├── .dockerignore        # Keeps .env, node_modules/, .git/ out of the image (P11)
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

## 👤 Author

**Milan Vadhel**  
GitHub: [@MilanVadhel01](https://github.com/MilanVadhel01)
