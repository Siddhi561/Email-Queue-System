import { Worker } from 'bullmq';
import redis from '../config/redis.js';
import { sendEmail } from '../services/emailService.js';
import pool, { query } from '../config/db.js';
import logger from '../config/logger.js';
import { moveToDeadLetter } from '../queues/emailQueue.js';

const worker = new Worker(
  'email',
  async (job) => {
    const { to, subject, body } = job.data;
    const jobId = job.id; // ← always use BullMQ job id

    logger.info('Processing email job', { jobId, to, attempt: job.attemptsMade + 1 });

    await query(
      `UPDATE email_jobs SET status = 'processing', attempts = $1, updated_at = NOW()
       WHERE job_id = $2`,
      [job.attemptsMade + 1, jobId]
    );

    await sendEmail({ to, subject, body });

    await query(
      `UPDATE email_jobs SET status = 'completed', updated_at = NOW()
       WHERE job_id = $1`,
      [jobId]
    );

    logger.info('Email job completed', { jobId, to });
  },
  {
    connection: redis,
    concurrency: 5,
  }
);

worker.on('completed', (job) => {
  logger.info('Job completed', { jobId: job.id });
});

worker.on('failed', async (job, err) => {
  logger.error('Job failed', {
    jobId: job.id,
    attempt: job.attemptsMade,
    error: err.message,
  });

  if (job.attemptsMade >= job.opts.attempts) {
    await moveToDeadLetter(job.data, err.message);

    await query(
      `UPDATE email_jobs SET status = 'failed', error = $1, updated_at = NOW()
       WHERE job_id = $2`,
      [err.message, job.id] // ← job.id not job.data.jobId
    );
  }
});

worker.on('error', (err) => {
  logger.error('Worker error', { error: err.message });
});

logger.info('Email worker started');

try {
  await pool.query('SELECT 1');
  logger.info('PostgreSQL connected');
} catch (err) {
  logger.error('PostgreSQL connection failed', { error: err.message });
  process.exit(1);
}

export default worker;