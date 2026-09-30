// ─────────────────────────────────────────────
// PRACTICAL 10 — EVENT LISTENERS
// Registers all task event listeners on the shared
// emitter. Required ONCE by server.js at startup,
// BEFORE any emit() can happen.
// ─────────────────────────────────────────────

// Import the shared event emitter instance
const taskEvents = require('./events');

// Simulated slow-handler delay in milliseconds
// (kept as a named constant per Practical 10 spec)
const SIMULATED_DELAY_MS = 2000;

// ─────────────────────────────────────────────
// LISTENER: task-created
// Simulates a slow, async post-processing step
// (e.g. sending a notification email) after a
// task is created — without blocking the API response.
// ─────────────────────────────────────────────
taskEvents.on('task-created', (task) => {
    // Read the assigned user from the task object,
    // falling back to 'Unassigned' when the schema
    // has no such field (it doesn't, per Practical 10)
    const assignedUser = task.assignedUser || 'Unassigned';

    // Log the start timestamp so sync vs async
    // ordering is visible in the console
    console.log(`[Listener] task-created started at ${new Date().toISOString()}`);

    // Simulate slow work: schedule the actual handler
    // body 2 seconds in the future (non-blocking)
    setTimeout(() => {
        // try/catch INSIDE the setTimeout callback so
        // async errors are caught and forwarded to the
        // 'error' listener instead of crashing the server
        try {
            // The "slow work": build and log a notification
            const timestamp = new Date().toISOString();
            console.log(`[Notification] Task "${task.title}" created at ${timestamp} | assigned to: ${assignedUser}`);
            console.log(`[Listener] task-created completed at ${new Date().toISOString()}`);
        } catch (err) {
            // Forward async errors to the central error listener
            taskEvents.emit('error', err);
        }
    }, SIMULATED_DELAY_MS);
});

// ─────────────────────────────────────────────
// LISTENER: task-deleted
// Logs a notification when a task is deleted
// (message format is DIFFERENT from task-created).
// ─────────────────────────────────────────────
taskEvents.on('task-deleted', (task) => {
    console.log(`[Notification] Task "${task.title}" deleted at ${new Date().toISOString()}`);
});

// ─────────────────────────────────────────────
// LISTENER: error
// Central error handler for emitted errors.
// Registered with .on() so an emitted 'error'
// NEVER crashes the server (unhandled 'error'
// events throw in Node — this prevents that).
// ─────────────────────────────────────────────
taskEvents.on('error', (err) => {
    console.error(`[Error] ${err.message} at ${new Date().toISOString()}`);
});

module.exports = taskEvents;
