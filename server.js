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

// Practical 13 — official OpenAI SDK, pointed at OpenRouter
const OpenAI = require('openai');

// Import our Task model
const Task = require('./models/Task');

// Import shared in-memory cache (Practical 9)
// Used to avoid hitting MongoDB on every GET /tasks request
const cache = require('./cache');

// Import shared event emitter (Practical 10)
const taskEvents = require('./events');

// Register all event listeners ONCE at startup,
// BEFORE any emit() can fire (Practical 10)
require('./listeners');

// ─────────────────────────────────────────────
// APP SETUP
// ─────────────────────────────────────────────
const app  = express();
const PORT = 5000;

// ─────────────────────────────────────────────
// PRACTICAL 13 — OPENROUTER AI CONFIGURATION
// The API key lives ONLY in the backend .env.
// A client is created only when a key is configured, so a
// missing key simply produces a graceful fallback instead
// of crashing the server at startup.
// ─────────────────────────────────────────────
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_OPENROUTER_MODEL = 'openrouter/free';
const AI_TITLE_MAX_LENGTH = 150;
const AI_RATE_LIMIT_MS = 60 * 1000; // one suggestion per task per minute
const AI_FALLBACK_MESSAGE =
    'AI suggestions are temporarily unavailable. Please enter your task description manually.';

// "openrouter/free" routes each request to a different free model, and many
// free models are *reasoning* models: they spend the whole token budget on
// hidden thinking and then return an empty message. A small budget (160) made
// roughly 5 of 6 clicks fail with the fallback. These values give the model
// room to finish thinking and still write the description.
const AI_MAX_TOKENS = 1000;
const AI_TIMEOUT_MS = 20000;   // slow free models need more than 15s
const AI_MAX_ATTEMPTS = 2;     // one retry — the router picks a different model
const AI_DESCRIPTION_MAX_LENGTH = 600; // some free models ramble far past 4 sentences

// Clearer messages for the two failures a free OpenRouter account actually hits.
const AI_QUOTA_MESSAGE =
    'The free AI quota for today is used up. Please enter your task description manually, or try again tomorrow.';
const AI_BUSY_MESSAGE =
    'The AI provider is busy right now. Please try again in a moment, or enter the description manually.';

// Keep the result close to the "2-4 sentences" the prompt asks for.
function trimDescription(text) {
    if (text.length <= AI_DESCRIPTION_MAX_LENGTH) {
        return text;
    }

    const cut = text.slice(0, AI_DESCRIPTION_MAX_LENGTH);
    const lastSentenceEnd = Math.max(
        cut.lastIndexOf('. '),
        cut.lastIndexOf('! '),
        cut.lastIndexOf('? ')
    );

    return lastSentenceEnd > 200
        ? cut.slice(0, lastSentenceEnd + 1)
        : cut.trimEnd();
}

let openaiClient = null;

if (process.env.OPENROUTER_API_KEY) {
    openaiClient = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: OPENROUTER_BASE_URL,
        timeout: AI_TIMEOUT_MS,
        maxRetries: 0     // the route retries once itself — protects the free quota
    });
}

// In-memory rate-limit store: "<ip>:<task>" → timestamp (ms).
// State is per-process and resets whenever the server restarts.
const aiRequestTimes = new Map();

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
// MONGODB CONNECTION
// The connection is made by startServer() at the bottom
// of this file, and only when the file is run directly
// (never when Jest imports the app for testing).
// ─────────────────────────────────────────────

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

        // Log BEFORE the response is sent so the sync vs
        // async ordering is visible in the console (Practical 10)
        console.log(`[API] Response sent at ${new Date().toISOString()}`);

        // Respond with the created task and status 201
        res.status(201).json(newTask);

        // Emit AFTER the response is sent — the listener's slow
        // work must never delay the HTTP response (Practical 10)
        taskEvents.emit('task-created', newTask);
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

        // Respond BEFORE emitting so the listener never delays the HTTP response
        res.status(200).json({ message: 'Task successfully deleted' });

        // Emit with the document returned by the delete call (Practical 10)
        taskEvents.emit('task-deleted', deletedTask);
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// PRACTICAL 13 — AI TASK DESCRIPTION
// POST /api/ai/generate-description
// Body: { title, taskId? }
// Returns: { description, fallback } or a controlled fallback.
// Only the task title is sent to OpenRouter.
// ─────────────────────────────────────────────
app.post('/api/ai/generate-description', async (req, res) => {
    // Same controlled fallback shape for every AI failure
    const fallbackResponse = (message) => ({
        description: '',
        fallback: true,
        message: message || AI_FALLBACK_MESSAGE
    });

    try {
        const { title, taskId } = req.body || {};

        // ── Validate the title ───────────────────
        if (typeof title !== 'string' || !title.trim()) {
            return res.status(400).json({ error: 'Title is required' });
        }

        const cleanTitle = title.trim();

        if (cleanTitle.length > AI_TITLE_MAX_LENGTH) {
            return res.status(400).json({
                error: `Title must be ${AI_TITLE_MAX_LENGTH} characters or fewer`
            });
        }

        // ── Rate limit: one request per task per minute ──
        // Existing task → its id; new task → client IP + normalized title.
        const taskKey = (typeof taskId === 'string' && taskId.trim())
            ? `task:${taskId.trim()}`
            : `title:${cleanTitle.toLowerCase()}`;
        const rateKey = `${req.ip}:${taskKey}`;
        const now = Date.now();

        // Drop expired entries so the map cannot grow forever
        for (const [key, timestamp] of aiRequestTimes) {
            if (now - timestamp >= AI_RATE_LIMIT_MS) {
                aiRequestTimes.delete(key);
            }
        }

        const lastRequest = aiRequestTimes.get(rateKey);
        if (lastRequest && now - lastRequest < AI_RATE_LIMIT_MS) {
            const retryAfterSeconds = Math.ceil(
                (AI_RATE_LIMIT_MS - (now - lastRequest)) / 1000
            );
            return res.status(429).json({
                description: '',
                fallback: true,
                message: `Please wait ${retryAfterSeconds} seconds before generating another description for this task.`,
                retryAfterSeconds
            });
        }

        // Count the attempt so repeated clicks cannot consume quota
        aiRequestTimes.set(rateKey, now);

        // ── Missing API key → graceful fallback ──
        if (!openaiClient) {
            console.warn('[AI] OPENROUTER_API_KEY is not configured — returning fallback');
            aiRequestTimes.delete(rateKey);
            return res.status(200).json(fallbackResponse());
        }

        // ── Ask OpenRouter for a description ─────
        const model = process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;
        let description = '';
        let lastError = null;

        for (let attempt = 1; attempt <= AI_MAX_ATTEMPTS && !description; attempt++) {
            try {
                const completion = await openaiClient.chat.completions.create({
                    model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You write short, useful task descriptions for a task management app. Given only a task title, reply with a professional description of 2-4 sentences. Do not repeat the title verbatim, do not use markdown or headings, and return only the description.'
                        },
                        {
                            role: 'user',
                            // Only the task title is sent to the external provider
                            content: cleanTitle
                        }
                    ],
                    temperature: 0.6,
                    max_tokens: AI_MAX_TOKENS
                });

                // ── Extract the generated text ───────
                const choice = completion && completion.choices && completion.choices[0];
                const text =
                    choice && choice.message && typeof choice.message.content === 'string'
                        ? choice.message.content.trim()
                        : '';

                if (text) {
                    description = trimDescription(text);
                } else {
                    // Reasoning models can burn the whole budget on hidden
                    // thinking and return no content at all.
                    console.warn(
                        `[AI] Empty completion (attempt ${attempt}/${AI_MAX_ATTEMPTS}, ` +
                        `finish_reason=${(choice && choice.finish_reason) || 'unknown'}, ` +
                        `model=${(completion && completion.model) || model})`
                    );
                }
            } catch (err) {
                lastError = err;
                console.warn(
                    `[AI] Attempt ${attempt}/${AI_MAX_ATTEMPTS} failed: ${err.message}`
                );

                // A 429 (daily free quota or provider rate limit) will not
                // clear within a retry, so stop and report it honestly.
                if (err && err.status === 429) {
                    break;
                }
            }
        }

        if (!description) {
            console.error(
                `[AI] No description returned — returning fallback` +
                (lastError ? ` (last error: ${lastError.message})` : '')
            );
            // Nothing was generated, so let the user click Generate again
            // straight away instead of waiting out the 60-second cooldown.
            aiRequestTimes.delete(rateKey);

            let message = AI_FALLBACK_MESSAGE;
            if (lastError && lastError.status === 429) {
                message = /free-models-per-day/.test(String(lastError.message))
                    ? AI_QUOTA_MESSAGE
                    : AI_BUSY_MESSAGE;
            }

            return res.status(200).json(fallbackResponse(message));
        }

        res.status(200).json({ description, fallback: false });
    } catch (err) {
        // Accepted failures: network errors, bad keys, quota limits,
        // unknown models and timeouts. Log a short reason on the server
        // only, and never leak provider details to the browser.
        console.error('[AI] Description generation failed:', err.message);
        res.status(200).json(fallbackResponse());
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
// START THE SERVER (Practical 12)
// Connects to MongoDB first, then starts listening.
// Only runs when this file is executed directly
// (`npm start` / `node server.js`). When Jest imports
// this module it receives the app WITHOUT a database
// connection, process.exit() call, or open port — so the
// test suite can connect to its own test database.
// ─────────────────────────────────────────────
async function startServer() {
    try {
        // Uses the connection string stored in .env
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB successfully');

        app.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
        });
    } catch (err) {
        console.error('❌ MongoDB connection failed:', err.message);
        process.exit(1); // Stop the server if DB connection fails
    }
}

if (require.main === module) {
    startServer();
}

// Export the Express application so Supertest can test it
// without starting a real server (Practical 12)
module.exports = app;
