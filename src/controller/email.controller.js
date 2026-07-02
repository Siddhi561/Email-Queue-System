import { addEmailJob } from '../queues/emailQueue.js';
import { query } from '../config/db.js';
import  logger from '../config/logger.js';
import asyncHandler from '../middleware/asyncHandler.js';

// POST /api/email/send
export const sendEmail = asyncHandler(async (req, res) => {
  const { to, subject, body, priority } = req.body; // already validated by Zod middleware


  const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  // insert row in DB with status 'queued' before adding to queue
  const result = await query(
    `INSERT INTO email_jobs (job_id, "to", subject, status)
     VALUES ($1, $2, $3, 'queued')
     RETURNING id`,
     [tempId, to, subject]
  );

  const dbId = result.rows[0].id;

  // add job to BullMQ queue
  const job = await addEmailJob(
    { to, subject, body, jobId: String(dbId) },
    priority || 10
  );

  const jobId = String(job.id);

  // now update the row with the real BullMQ job id
  await query(
    `UPDATE email_jobs SET job_id = $1 WHERE id = $2`,
    [job.id, dbId]
  );

  logger.info('Email job queued', { jobId: job.id, to, priority: priority || 10 });

  res.status(202).json({
  success: true,
  message: 'Email queued successfully',
  jobId: String(job.id),
  priority: priority || 10,
});
});

// GET /api/email/status/:jobId
export const getEmailStatus = asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  const result = await query(
    `SELECT job_id, "to", subject, status, attempts, error, created_at, updated_at
     FROM email_jobs WHERE job_id = $1`,
    [jobId]
  );

  if (result.rows.length === 0) {
    const err = new Error('Job not found');
    err.statusCode = 404;
    throw err;
  }

  res.status(200).json({
    success: true,
    data: result.rows[0],
  });
});