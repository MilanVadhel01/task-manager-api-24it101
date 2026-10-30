// ─────────────────────────────────────────────
// PRACTICAL 12 — AUTOMATED API TESTS
// Jest + Supertest tests for the Task Management API.
//
// These tests run against a DEDICATED test database
// (taskdb_test) so real application data is never touched.
// ─────────────────────────────────────────────

const mongoose = require('mongoose');
const request  = require('supertest');

// Import the Express app. server.js only connects to MongoDB and
// starts listening when run directly, so requiring it here opens
// no port and never calls process.exit().
const app = require('../server');

const Task  = require('../models/Task');
const cache = require('../cache');

// Dedicated test database. In GitHub Actions this comes from the
// MONGO_TEST_URI set in the workflow (MongoDB service container).
const MONGO_TEST_URI =
    process.env.MONGO_TEST_URI || 'mongodb://127.0.0.1:27017/taskdb_test';

// Connect to the test database once, before any test runs
beforeAll(async () => {
    await mongoose.connect(MONGO_TEST_URI);
});

// Clean the test database and the in-memory cache between tests,
// so every test starts from a known state
afterEach(async () => {
    await Task.deleteMany({});
    cache.flushAll();
});

// Close the Mongoose connection so Jest exits cleanly
afterAll(async () => {
    await mongoose.connection.close();
});

describe('GET /tasks', () => {
    test('returns 200 and the list of tasks', async () => {
        // Seed one task directly through Mongoose so the test can
        // verify the real response structure of the API
        await Task.create({
            title: 'Test task for CI',
            description: 'Created by the Jest + Supertest suite',
            priority: 'medium'
        });

        // Seeded behind the API's back — drop any cached task list
        cache.flushAll();

        const response = await request(app).get('/tasks');

        expect(response.statusCode).toBe(201);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body).toHaveLength(1);

        const [task] = response.body;
        expect(task).toHaveProperty('_id');
        expect(task.title).toBe('Test task for CI');
        expect(task.description).toBe('Created by the Jest + Supertest suite');
        expect(task.completed).toBe(false);
        expect(task.priority).toBe('medium');
        expect(task).toHaveProperty('createdAt');
    });
});

describe('GET /tasks/:id', () => {
    test('returns 404 with an error message for a nonexistent task', async () => {
        // A valid MongoDB ObjectId that does not exist in the database
        const missingId = new mongoose.Types.ObjectId().toString();

        const response = await request(app).get(`/tasks/${missingId}`);

        // The API's real 404 response format
        expect(response.statusCode).toBe(404);
        expect(response.body).toEqual({ error: 'Task not found' });
    });
});
