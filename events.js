// ─────────────────────────────────────────────
// PRACTICAL 10 — EVENT-DRIVEN ARCHITECTURE
// Shared event emitter for task lifecycle events.
// Uses ONLY Node's built-in 'events' module.
// ─────────────────────────────────────────────

// Import Node's built-in EventEmitter class
const EventEmitter = require('events');

// Custom emitter class so we have a dedicated
// emitter instance for task-related events
class TaskEvents extends EventEmitter {}

// Export ONE shared instance — every module that
// requires this file gets the same emitter, so
// listeners registered elsewhere will fire on emits here
module.exports = new TaskEvents();
