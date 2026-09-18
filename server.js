// ─────────────────────────────────────────────
// PRACTICAL 5 — Task Management API
// Express + MongoDB + Mongoose
// ─────────────────────────────────────────────

// Load environment variables from .env file
// Must be called before anything that reads process.env
require('dotenv').config();

// Import required packages
const express  = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Import our Task model
const Task = require('./models/Task');

// Import shared in-memory cache (Practical 9)
// Used to avoid hitting MongoDB on every GET /tasks request
const cache = require('./cache');

// ─────────────────────────────────────────────
// APP SETUP
// ─────────────────────────────────────────────
const app  = express();
const PORT = 5000;

// Middleware: CORS
app.use(cors());

// Middleware: parse incoming JSON request bodies
app.use(express.json());

// ─────────────────────────────────────────────
// GLOBAL LOGGING MIDDLEWARE
// Logs every request with method, URL, and time
// ─────────────────────────────────────────────
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`${req.method} ${req.url} - ${timestamp}`);
    next();
});

// ─────────────────────────────────────────────
// CONNECT TO MONGODB
// Uses the connection string stored in .env
// ─────────────────────────────────────────────
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB successfully');
    })
    .catch((err) => {
        console.error('❌ MongoDB connection failed:', err.message);
        process.exit(1); // Stop the server if DB connection fails
    });

// ─────────────────────────────────────────────
// ROUTES — CRUD OPERATIONS
// ─────────────────────────────────────────────

// ── GET /tasks ───────────────────────────────
// Returns all tasks from the database
// Checks the in-memory cache first to avoid unnecessary DB queries
app.get('/tasks', async (req, res, next) => {
    try {
        // Check if tasks are already cached
        const cached = cache.get('all_tasks');
        if (cached) {
            // Cache hit — return cached data without querying MongoDB
            console.log('📦 Cache HIT for all_tasks');
            return res.status(200).json(cached);
        }

        // Cache miss — fetch from MongoDB and store in cache
        console.log('🔍 Cache MISS for all_tasks — querying MongoDB');
        const tasks = await Task.find();
        cache.set('all_tasks', tasks);
        res.status(200).json(tasks);
    } catch (err) {
        // Pass any error to the global error handler
        next(err);
    }
});

// ── Supplementary Problem 3 ──────────────────
// GET /tasks/:id
// Returns a single task by its MongoDB _id
// Returns 404 JSON if not found
// Also cached individually by task id (Practical 9 stretch)
app.get('/tasks/:id', async (req, res, next) => {
    try {
        const cacheKey = `task_${req.params.id}`;

        // Check if this specific task is cached
        const cached = cache.get(cacheKey);
        if (cached) {
            console.log(`📦 Cache HIT for ${cacheKey}`);
            return res.status(200).json(cached);
        }

        console.log(`🔍 Cache MISS for ${cacheKey} — querying MongoDB`);
        const task = await Task.findById(req.params.id);

        // If no task was found, respond with 404
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Store individual task in cache
        cache.set(cacheKey, task);
        res.status(200).json(task);
    } catch (err) {
        next(err);
    }
});

// ── POST /tasks ───────────────────────────────
// Creates a new task and saves it to the database
app.post('/tasks', async (req, res, next) => {
    try {
        // Destructure allowed fields from the request body
        const { title, description, completed, priority } = req.body;

        // Create a new task document using the Task model
        const newTask = await Task.create({
            title,
            description,
            completed,
            priority
        });

        // Invalidate the all_tasks cache so the next GET reflects the new task
        cache.del('all_tasks');

        // Respond with the created task and status 201
        res.status(201).json(newTask);
    } catch (err) {
        // Handle Mongoose validation errors cleanly
        if (err.name === 'ValidationError') {
            // Extract only the human-readable messages
            const messages = Object.values(err.errors).map(e => e.message);
            return res.status(400).json({ error: messages.join(', ') });
        }
        next(err);
    }
});

// ── PUT /tasks/:id ────────────────────────────
// Updates an existing task by its MongoDB _id
// Returns 404 if the task does not exist
app.put('/tasks/:id', async (req, res, next) => {
    try {
        const { title, description, completed, priority } = req.body;

        // findByIdAndUpdate: find by _id, apply changes, return updated doc
        const updatedTask = await Task.findByIdAndUpdate(
            req.params.id,
            { title, description, completed, priority },
            {
                new: true,           // return the updated document
                runValidators: true  // run schema validators on update
            }
        );

        // If no matching task was found, return 404
        if (!updatedTask) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Invalidate both the all_tasks cache and this task's individual cache
        cache.del('all_tasks');
        cache.del(`task_${req.params.id}`);

        res.status(200).json(updatedTask);
    } catch (err) {
        // Handle Mongoose validation errors cleanly
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(e => e.message);
            return res.status(400).json({ error: messages.join(', ') });
        }
        next(err);
    }
});

// ── DELETE /tasks/:id ─────────────────────────
// Deletes a task by its MongoDB _id
// Returns 404 if the task does not exist
app.delete('/tasks/:id', async (req, res, next) => {
    try {
        const deletedTask = await Task.findByIdAndDelete(req.params.id);

        // If no matching task was found, return 404
        if (!deletedTask) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Invalidate both the all_tasks cache and this task's individual cache
        cache.del('all_tasks');
        cache.del(`task_${req.params.id}`);

        res.status(200).json({ message: 'Task successfully deleted' });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// DEBUG / CACHE STATS (Practical 9 stretch)
// Exposes cache hit/miss counts and current keys
// ─────────────────────────────────────────────
app.get('/debug/cache-stats', (req, res) => {
    // getStats() returns { hits, misses, keys, ksize, vsize }
    const stats = cache.getStats();
    res.status(200).json({
        hits: stats.hits,
        misses: stats.misses,
        currentKeys: cache.keys(),
        keyCount: cache.keys().length
    });
});

// ─────────────────────────────────────────────
// GLOBAL ERROR HANDLING MIDDLEWARE
// Must be the LAST app.use()
// Catches any error passed via next(err)
// ─────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Server error:', err.message);
    res.status(500).json({ error: 'Something went wrong' });
});

// ─────────────────────────────────────────────
// START THE SERVER
// ─────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
