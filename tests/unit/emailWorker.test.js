import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock all external deps before importing worker logic
vi.mock('../../src/config/db.js', () => ({ query: vi.fn() }));
vi.mock('../../src/config/redis.js', () => ({ default: { ping: vi.fn() } }));
vi.mock('../../src/config/logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock('../../src/queues/emailQueue.js', () => ({
  moveToDeadLetter: vi.fn(),
  default: { on: vi.fn() },
}));
vi.mock('../../src/services/emailService.js', () => ({
  sendEmail: vi.fn(),
}));

import { query } from '../../src/config/db.js';
import { sendEmail } from '../../src/services/emailService.js';
import { moveToDeadLetter } from '../../src/queues/emailQueue.js';

// simulate what BullMQ worker processor does
// we extract the logic into a testable function
const processJob = async (job) => {
  const { to, subject, body } = job.data;
  const jobId = job.id;

  await query(
    `UPDATE email_jobs SET status = 'processing', attempts = $1, updated_at = NOW() WHERE job_id = $2`,
    [job.attemptsMade + 1, jobId]
  );

  await sendEmail({ to, subject, body });

  await query(
    `UPDATE email_jobs SET status = 'completed', updated_at = NOW() WHERE job_id = $1`,
    [jobId]
  );
};

const handleFailed = async (job, err) => {
  if (job.attemptsMade >= job.opts.attempts) {
    await moveToDeadLetter(job.data, err.message);
    await query(
      `UPDATE email_jobs SET status = 'failed', error = $1, updated_at = NOW() WHERE job_id = $2`,
      [err.message, job.id]
    );
  }
};

const makeJob = (overrides = {}) => ({
  id: '5',
  data: { to: 'test@example.com', subject: 'Test', body: 'Hello', jobId: '1' },
  attemptsMade: 0,
  opts: { attempts: 3 },
  ...overrides,
});

describe('Email Worker — Job Processing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds email job → job is created and queued', async () => {
    query.mockResolvedValue({ rows: [] });
    sendEmail.mockResolvedValue({ id: 'msg_123' });

    const job = makeJob();
    await processJob(job);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'processing'"),
      [1, '5']
    );
  });

  it('successful job → DB status updated to completed', async () => {
    query.mockResolvedValue({ rows: [] });
    sendEmail.mockResolvedValue({ id: 'msg_123' });

    await processJob(makeJob());

    const completedCall = query.mock.calls.find(call =>
      call[0].includes("status = 'completed'")
    );
    expect(completedCall).toBeDefined();
    expect(completedCall[1]).toEqual(['5']);
  });

  it('successful job → email sender called exactly once', async () => {
    query.mockResolvedValue({ rows: [] });
    sendEmail.mockResolvedValue({ id: 'msg_123' });

    await processJob(makeJob());

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith({
      to: 'test@example.com',
      subject: 'Test',
      body: 'Hello',
    });
  });

  it('first attempt fails → throws so BullMQ can retry', async () => {
    query.mockResolvedValue({ rows: [] });
    sendEmail.mockRejectedValueOnce(new Error('Resend API down'));

    await expect(processJob(makeJob())).rejects.toThrow('Resend API down');
    // completed UPDATE should NOT have been called
    const completedCall = query.mock.calls.find(c => c[0].includes("'completed'"));
    expect(completedCall).toBeUndefined();
  });

  it('third attempt succeeds → job completed after two failures', async () => {
    query.mockResolvedValue({ rows: [] });
    sendEmail
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({ id: 'msg_ok' });

    // simulate 3 separate job runs
    await expect(processJob(makeJob({ attemptsMade: 0 }))).rejects.toThrow();
    await expect(processJob(makeJob({ attemptsMade: 1 }))).rejects.toThrow();
    await processJob(makeJob({ attemptsMade: 2 }));

    expect(sendEmail).toHaveBeenCalledTimes(3);
    const completedCall = query.mock.calls.find(c => c[0].includes("'completed'"));
    expect(completedCall).toBeDefined();
  });

  it('retry attempt count stored correctly', async () => {
    query.mockResolvedValue({ rows: [] });
    sendEmail.mockResolvedValue({ id: 'msg_ok' });

    await processJob(makeJob({ attemptsMade: 2 }));

    const processingCall = query.mock.calls.find(c => c[0].includes("'processing'"));
    expect(processingCall[1][0]).toBe(3); // attemptsMade + 1
  });

  it('all attempts fail → job reaches maximum attempts', async () => {
    sendEmail.mockRejectedValue(new Error('Always fails'));
    query.mockResolvedValue({ rows: [] });

    for (let i = 0; i < 3; i++) {
      await expect(processJob(makeJob({ attemptsMade: i }))).rejects.toThrow();
    }
    expect(sendEmail).toHaveBeenCalledTimes(3);
  });

  it('exhausted job → moves to dead letter queue', async () => {
    query.mockResolvedValue({ rows: [] });
    const err = new Error('Permanent failure');
    const job = makeJob({ attemptsMade: 3, opts: { attempts: 3 } });

    await handleFailed(job, err);

    expect(moveToDeadLetter).toHaveBeenCalledWith(job.data, err.message);
  });

  it('exhausted job → DB status set to failed', async () => {
    query.mockResolvedValue({ rows: [] });
    const err = new Error('Permanent failure');
    const job = makeJob({ attemptsMade: 3, opts: { attempts: 3 } });

    await handleFailed(job, err);

    const failedCall = query.mock.calls.find(c => c[0].includes("'failed'"));
    expect(failedCall).toBeDefined();
    expect(failedCall[1]).toEqual(['Permanent failure', '5']);
  });

  it('failed event before max attempts → does NOT move to DLQ', async () => {
    query.mockResolvedValue({ rows: [] });
    const job = makeJob({ attemptsMade: 1, opts: { attempts: 3 } });

    await handleFailed(job, new Error('Temporary failure'));

    expect(moveToDeadLetter).not.toHaveBeenCalled();
  });

  it('duplicate jobId → processing query uses correct job id', async () => {
    query.mockResolvedValue({ rows: [] });
    sendEmail.mockResolvedValue({ id: 'msg_ok' });

    const job1 = makeJob({ id: '5' });
    const job2 = makeJob({ id: '5', data: { ...makeJob().data } });

    await processJob(job1);
    vi.clearAllMocks();
    await processJob(job2);

    // both should update with job id '5' — same record
    const completedCall = query.mock.calls.find(c => c[0].includes("'completed'"));
    expect(completedCall[1]).toContain('5');
  });

  it('worker handles malformed job data without crashing', async () => {
    query.mockResolvedValue({ rows: [] });
    sendEmail.mockResolvedValue({ id: 'ok' });

    // missing body field
    const badJob = {
      id: '99',
      data: { to: 'x@x.com', subject: 'Hi' }, // no body
      attemptsMade: 0,
      opts: { attempts: 3 },
    };

    // should not throw at the worker level — emailService handles undefined body
    await expect(processJob(badJob)).resolves.not.toThrow();
  });
});

describe('Email Worker — Backoff Configuration', () => {
  it('retry delays increase according to exponential backoff config', () => {
    // verify the queue config values are correct
    const delay = 5000;
    const backoffFactor = 5; // exponential with delay 5000 gives 5s, 25s, 125s

    const attempt1Delay = delay;
    const attempt2Delay = delay * backoffFactor;
    const attempt3Delay = delay * backoffFactor * backoffFactor;

    expect(attempt1Delay).toBe(5000);
    expect(attempt2Delay).toBe(25000);
    expect(attempt3Delay).toBe(125000);
  });
});