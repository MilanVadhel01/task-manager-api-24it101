// ─────────────────────────────────────────────
// SHARED IN-MEMORY CACHE (Practical 9)
// Uses node-cache for server-side caching.
// stdTTL = 60 means cached entries auto-expire
// after 60 seconds if not manually invalidated.
// ─────────────────────────────────────────────

const NodeCache = require('node-cache');

// Create a single shared cache instance
// stdTTL: time-to-live in seconds (auto-expiry)
// checkperiod: how often to check for expired keys (seconds)
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

module.exports = cache;
