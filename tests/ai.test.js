// ─────────────────────────────────────────────
// PRACTICAL 13 — AI ROUTE TESTS
// The OpenAI SDK is mocked, so these tests never call
// OpenRouter and never consume real API quota.
// ─────────────────────────────────────────────

jest.mock('openai');

const request = require('supertest');

// Configure a fake key + model BEFORE server.js is required, because
// the OpenRouter client is created once at module load.
process.env.OPENROUTER_API_KEY = 'test-key-not-real';
process.env.OPENROUTER_MODEL = 'test/free-model';

const OpenAI = require('openai');
const mockCreate = jest.fn();

OpenAI.mockImplementation(() => ({
    chat: {
        completions: {
            create: mockCreate
        }
    }
}));

const app = require('../server');

const FALLBACK_MESSAGE =
    'AI suggestions are temporarily unavailable. Please enter your task description manually.';

beforeEach(() => {
    mockCreate.mockReset();
});

describe('POST /api/ai/generate-description', () => {
    test('returns the generated description and fallback: false', async () => {
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: '  Write the practical report and record the results.  ' } }]
        });

        const response = await request(app)
            .post('/api/ai/generate-description')
            .send({ title: 'Complete Machine Learning practical' });

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual({
            description: 'Write the practical report and record the results.',
            fallback: false
        });

        // Only the title is sent, with the configured model and limits
        expect(mockCreate).toHaveBeenCalledTimes(1);
        const args = mockCreate.mock.calls[0][0];
        expect(args.model).toBe('test/free-model');
        expect(args.temperature).toBe(0.6);
        // Enough room for reasoning models to think *and* answer
        expect(args.max_tokens).toBeGreaterThanOrEqual(800);
        expect(args.messages.find(m => m.role === 'user')).toEqual({
            role: 'user',
            content: 'Complete Machine Learning practical'
        });

        // The API key must never be forwarded to the frontend
        expect(JSON.stringify(response.body)).not.toContain('test-key-not-real');
    });

    test('retries once when a reasoning model returns an empty completion', async () => {
        // First model spends its budget on hidden reasoning and returns nothing
        mockCreate
            .mockResolvedValueOnce({ choices: [{ message: { content: '' }, finish_reason: 'length' }] })
            .mockResolvedValueOnce({ choices: [{ message: { content: 'Draft the release checklist.' } }] });

        const response = await request(app)
            .post('/api/ai/generate-description')
            .send({ title: 'Empty completion retry task' });

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual({
            description: 'Draft the release checklist.',
            fallback: false
        });
        expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    test('retries once after a provider error and still succeeds', async () => {
        mockCreate
            .mockRejectedValueOnce(new Error('Request timed out.'))
            .mockResolvedValueOnce({ choices: [{ message: { content: 'Review the open pull requests.' } }] });

        const response = await request(app)
            .post('/api/ai/generate-description')
            .send({ title: 'Timeout retry task' });

        expect(response.statusCode).toBe(200);
        expect(response.body.fallback).toBe(false);
        expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    test('rejects an empty title without calling the AI provider', async () => {
        const response = await request(app)
            .post('/api/ai/generate-description')
            .send({ title: '   ' });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({ error: 'Title is required' });
        expect(mockCreate).not.toHaveBeenCalled();
    });

    test('returns a graceful fallback when the provider fails', async () => {
        mockCreate.mockRejectedValue(new Error('401 Invalid API key'));

        const response = await request(app)
            .post('/api/ai/generate-description')
            .send({ title: 'Provider failure demonstration task' });

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual({
            description: '',
            fallback: true,
            message: FALLBACK_MESSAGE
        });
    });

    test('reports the daily free quota clearly and does not retry', async () => {
        const quotaError = Object.assign(
            new Error('429 Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day'),
            { status: 429 }
        );
        mockCreate.mockRejectedValue(quotaError);

        const response = await request(app)
            .post('/api/ai/generate-description')
            .send({ title: 'Quota exhausted task' });

        expect(response.statusCode).toBe(200);
        expect(response.body.fallback).toBe(true);
        expect(response.body.message).toMatch(/free AI quota for today is used up/i);

        // A 429 cannot clear within a retry, so the provider is called once
        expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    test('trims a rambling description to the sentence budget', async () => {
        const sentence = 'Review the deployment checklist with the team before release. ';
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: sentence.repeat(40) } }]
        });

        const response = await request(app)
            .post('/api/ai/generate-description')
            .send({ title: 'Very long description task' });

        expect(response.body.fallback).toBe(false);
        expect(response.body.description.length).toBeLessThanOrEqual(600);
        expect(response.body.description.endsWith('.')).toBe(true);
    });

    test('a failed generation does not consume the rate-limit cooldown', async () => {
        mockCreate
            .mockRejectedValueOnce(new Error('Request timed out.'))
            .mockRejectedValueOnce(new Error('Request timed out.'))
            .mockResolvedValueOnce({ choices: [{ message: { content: 'Reschedule the review meeting.' } }] });

        const title = 'Retry after failure task';

        const failed = await request(app)
            .post('/api/ai/generate-description')
            .send({ title });

        expect(failed.body.fallback).toBe(true);

        // Clicking Generate again immediately must reach the provider, not 429
        const retried = await request(app)
            .post('/api/ai/generate-description')
            .send({ title });

        expect(retried.statusCode).toBe(200);
        expect(retried.body).toEqual({
            description: 'Reschedule the review meeting.',
            fallback: false
        });
    });

    test('blocks a second request for the same task within a minute', async () => {
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: 'Prepare the weekly progress report.' } }]
        });

        const title = 'Rate limited practical task';

        const first = await request(app)
            .post('/api/ai/generate-description')
            .send({ title });

        const second = await request(app)
            .post('/api/ai/generate-description')
            .send({ title });

        expect(first.statusCode).toBe(200);
        expect(first.body.fallback).toBe(false);

        expect(second.statusCode).toBe(429);
        expect(second.body.fallback).toBe(true);
        expect(second.body.message).toMatch(/Please wait \d+ seconds/);
        expect(second.body.retryAfterSeconds).toBeGreaterThan(0);
        expect(second.body.retryAfterSeconds).toBeLessThanOrEqual(60);

        // The blocked request never reached the provider
        expect(mockCreate).toHaveBeenCalledTimes(1);
    });
});
