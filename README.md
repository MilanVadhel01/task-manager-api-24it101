# 📝 Task Manager API — Practical 5

A beginner-friendly **REST API** built with **Node.js**, **Express.js**, and **MongoDB (Mongoose)**.  
This project replaces the Practical 4 in-memory storage with a real MongoDB database.

---

## 🚀 Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | Runtime environment |
| Express.js | Web framework |
| MongoDB | NoSQL database |
| Mongoose | MongoDB ODM (Object Data Modelling) |
| dotenv | Load environment variables from `.env` |

---

## 📁 Project Structure

```
practical-task-api/
├── models/
│   └── Task.js          # Mongoose schema & model
├── .env                 # Your MongoDB connection string (git-ignored)
├── .env.example         # Template for environment variables
├── .gitignore           # Ignores node_modules/ and .env
├── package.json         # Project metadata & dependencies
├── package-lock.json    # Locked dependency versions
└── server.js            # Main Express application
```

---

## ⚙️ Setup & Installation

### 1. Clone the repository

```bash
git clone https://github.com/MilanVadhel01/task-manager-api-24it101.git
cd task-manager-api-24it101
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the root directory:

```bash
copy .env.example .env
```

Then open `.env` and fill in your MongoDB Atlas connection string:

```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/taskdb?retryWrites=true&w=majority
```

### 4. Start the server

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

## 📊 HTTP Status Codes Used

| Code | Meaning |
|---|---|
| `200` | OK — request succeeded |
| `201` | Created — new resource created |
| `400` | Bad Request — validation error |
| `404` | Not Found — resource doesn't exist |
| `500` | Internal Server Error — something went wrong |

---

## 👤 Author

**Milan Vadhel**  
GitHub: [@MilanVadhel01](https://github.com/MilanVadhel01)
