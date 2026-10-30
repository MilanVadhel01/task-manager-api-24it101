// ─────────────────────────────────────────────
// PRACTICAL 13 — MISSING API KEY FALLBACK
// An empty key (not just a wrong one) must still return
// a controlled response. dotenv never overwrites a variable
// that already exists, so this empty value wins over .env.
// ─────────────────────────────────────────────

process.env.OPENROUTER_API_KEY = '';

const request = require('supertest');
const app = require('../server');

test('returns the graceful fallback when OPENROUTER_API_KEY is missing', async () => {
    const response = await request(app)
        .post('/api/ai/generate-description')
        .send({ title: 'Task created without an AI key' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
        description: '',
        fallback: true,
        message: 'AI suggestions are temporarily unavailable. Please enter your task description manually.'
    });
});
