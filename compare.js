// ─────────────────────────────────────────────
// PRACTICAL 10 — EDA vs NON-EDA TIMING COMPARISON
// Standalone demo comparing how long an HTTP
// request takes when post-processing is done
// INLINE (blocking the response) versus via the
// EVENT-DRIVEN ARCHITECTURE (response first,
// listener work happens asynchronously).
//
// Run with: node compare.js
// Uses ONLY Node built-ins (no extra packages).
// ─────────────────────────────────────────────

// Import the shared event emitter + listeners
// (same instances the API server uses)
const taskEvents = require('./events');
require('./listeners');

// Simulated slow-handler delay — must match the
// constant used in listeners.js (Practical 10 spec)
const SIMULATED_DELAY_MS = 2000;

// Number of requests to simulate per pattern
const NUM_REQUESTS = 5;

// ─────────────────────────────────────────────
// PATTERN 1 — WITHOUT EDA (inline handler)
// The slow work runs BEFORE the response is sent,
// so the client waits the full 2 seconds.
// ─────────────────────────────────────────────
function createTaskWithoutEda() {
    // t0 = when the request arrives
    const t0 = Date.now();

    // Simulate the DB write being instant; the slow
    // notification work happens INLINE, blocking the response
    setTimeout(() => {
        // Do the "slow work" first (notification logging)
        const start = Date.now();
        console.log(`[No-EDA] slow work started at ${new Date(start).toISOString()}`);

        // Busy-wait to simulate synchronous CPU-bound work
        // (a real blocking call, unlike the async listener)
        while (Date.now() - start < SIMULATED_DELAY_MS) {
            // spin — blocks the event loop on purpose
        }

        console.log(`[No-EDA] slow work finished at ${new Date().toISOString()}`);

        // ONLY NOW is the response sent
        const elapsed = Date.now() - t0;
        console.log(`[No-EDA] response sent after ${elapsed} ms`);
        timingsNoEda.push(elapsed);
        if (timingsNoEda.length === NUM_REQUESTS) printSummary();
    }, 0);
}

// ─────────────────────────────────────────────
// PATTERN 2 — WITH EDA (event-driven)
// The response is sent IMMEDIATELY; the slow work
// is triggered by the 'task-created' event and runs
// asynchronously ~2s later without blocking anything.
// ─────────────────────────────────────────────
function createTaskWithEda() {
    // t0 = when the request arrives
    const t0 = Date.now();

    // 1. Response is sent right away (no slow work inline)
    const elapsed = Date.now() - t0;
    console.log(`[EDA] response sent after ${elapsed} ms`);
    timingsEda.push(elapsed);

    // 2. Emit AFTER the response — listener handles the slow work
    taskEvents.emit('task-created', { title: 'EDA demo task', assignedUser: undefined });

    // 3. Print summary once all EDA requests are done
    if (timingsEda.length === NUM_REQUESTS) printSummary();
}

// ─────────────────────────────────────────────
// TIMING COLLECTORS + SUMMARY
// ─────────────────────────────────────────────
const timingsNoEda = [];
const timingsEda = [];

let summaryPrinted = false;
function printSummary() {
    // Wait until BOTH patterns have all their timings
    if (timingsNoEda.length < NUM_REQUESTS || timingsEda.length < NUM_REQUESTS) return;
    if (summaryPrinted) return; // guard against double print
    summaryPrinted = true;

    const avg = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

    console.log('\n══════════════ RESULTS ══════════════');
    console.log(`Requests per pattern: ${NUM_REQUESTS}`);
    console.log(`Without EDA (inline) — avg response time: ${avg(timingsNoEda)} ms`);
    console.log(`With EDA (events)    — avg response time: ${avg(timingsEda)} ms`);
    console.log('──────────────────────────────────────');
    console.log('The EDA response returns immediately;');
    console.log(`the notification work still happens, just ~${SIMULATED_DELAY_MS} ms later in the background.`);
}

// ─────────────────────────────────────────────
// MAIN — run the comparison
// ─────────────────────────────────────────────
console.log('─── WITHOUT EDA (inline slow work blocks the response) ───');
for (let i = 1; i <= NUM_REQUESTS; i++) {
    console.log(`\nRequest ${i}:`);
    createTaskWithoutEda();
}

// Let the No-EDA runs finish before switching patterns
// (the busy-wait blocks, so this needs a fresh tick loop)
setTimeout(() => {
    console.log('\n─── WITH EDA (response first, listener work async) ───');
    for (let i = 1; i <= NUM_REQUESTS; i++) {
        console.log(`\nRequest ${i}:`);
        createTaskWithEda();
    }
    // Keep the process alive long enough for the ~2s
    // listener delays to fire and the summary to print
    setTimeout(() => {}, SIMULATED_DELAY_MS + 1000);
}, SIMULATED_DELAY_MS * NUM_REQUESTS + 500);
