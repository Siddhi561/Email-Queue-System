import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../src/config/db.js', () => ({
  query: vi.fn(),
  initDB: vi.fn().mockResolvedValue(undefined),
  default: {},
}));

vi.mock('../../src/config/redis.js', () => ({
  default: {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(55),
    ping: vi.fn().mockResolvedValue('PONG'),
  },
}));

vi.mock('../../src/queues/emailQueue.js', () => ({
  addEmailJob: vi.fn().mockResolvedValue({ id: '7' }),
  default: { on: vi.fn() },
}));

vi.mock('../../src/config/logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import app from '../../src/app.js';
import { query } from '../../src/config/db.js';
import { addEmailJob } from '../../src/queues/emailQueue.js';

describe('POST /api/email/send', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.mockResolvedValue({ rows: [{ id: 12 }] });
    addEmailJob.mockResolvedValue({ id: '7' });
  });

  it('valid request → returns 202 with jobId', async () => {
    const res = await request(app)
      .post('/api/email/send')
      .send({ to: 'user@example.com', subject: 'Hello', body: 'Test body' });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.jobId).toBeDefined();
  });

  it('missing to field → returns 400 validation error', async () => {
    const res = await request(app)
      .post('/api/email/send')
      .send({ subject: 'Hello', body: 'Body' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.issues).toBeDefined();
  });

  it('invalid email → returns 400 with field issue', async () => {
    const res = await request(app)
      .post('/api/email/send')
      .send({ to: 'not-an-email', subject: 'Hi', body: 'Body' });

    expect(res.status).toBe(400);
    expect(res.body.issues[0].field).toBe('to');
  });

  it('missing subject → returns 400', async () => {
    const res = await request(app)
      .post('/api/email/send')
      .send({ to: 'a@b.com', body: 'Body' });

    expect(res.status).toBe(400);
  });

  it('valid request → inserts job record in DB', async () => {
    await request(app)
      .post('/api/email/send')
      .send({ to: 'user@example.com', subject: 'Hi', body: 'Body' });

    const insertCall = query.mock.calls.find(c => c[0].includes('INSERT'));
    expect(insertCall).toBeDefined();
  });

  it('valid request → job data persisted correctly in PostgreSQL', async () => {
    await request(app)
      .post('/api/email/send')
      .send({ to: 'user@example.com', subject: 'My Subject', body: 'Body' });

    const insertCall = query.mock.calls.find(c => c[0].includes('INSERT'));
    expect(insertCall[1]).toContain('user@example.com');
    expect(insertCall[1]).toContain('My Subject');
  });

  it('rate limit exceeded → returns 429', async () => {
    const redis = (await import('../../src/config/redis.js')).default;
    redis.incr.mockResolvedValue(6); // over limit

    const res = await request(app)
      .post('/api/email/send')
      .send({ to: 'user@example.com', subject: 'Hi', body: 'Body' });

    expect(res.status).toBe(429);
    expect(res.body.error).toBe('Too many requests');
  });
});

describe('GET /api/email/status/:jobId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('existing job → returns job data with completed status', async () => {
    query.mockResolvedValue({
      rows: [{
        job_id: '7', to: 'a@b.com', subject: 'Hi',
        status: 'completed', attempts: 1, error: null,
        created_at: new Date(), updated_at: new Date(),
      }],
    });

    const res = await request(app).get('/api/email/status/7');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.job_id).toBe('7');
  });

  it('completed job → correct DB record updated', async () => {
    query.mockResolvedValue({
      rows: [{ job_id: '7', status: 'completed', attempts: 1, error: null,
        to: 'x@x.com', subject: 'S', created_at: new Date(), updated_at: new Date() }],
    });

    const res = await request(app).get('/api/email/status/7');
    expect(res.body.data.job_id).toBe('7');
  });

  it('failed job → correct error stored in DB record', async () => {
    query.mockResolvedValue({
      rows: [{ job_id: '8', status: 'failed', attempts: 3,
        error: 'Email send failed: rate limit exceeded',
        to: 'x@x.com', subject: 'S', created_at: new Date(), updated_at: new Date() }],
    });

    const res = await request(app).get('/api/email/status/8');
    expect(res.body.data.status).toBe('failed');
    expect(res.body.data.error).toContain('rate limit exceeded');
  });

  it('non-existent job → returns 404', async () => {
    query.mockResolvedValue({ rows: [] });

    const res = await request(app).get('/api/email/status/999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Job not found');
  });
});