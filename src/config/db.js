import pg from 'pg';
import  logger  from './logger.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
});

pool.on('connect', () => logger.info('PostgreSQL connected'));
pool.on('error', (err) => logger.error('PostgreSQL pool error', { error: err.message }));

//aggressive shutdown by neon
export const query = async (text, params) => {
  try {
    return await pool.query(text, params);
  } catch (err) {
    if (err.message.includes('terminated') || err.message.includes('timeout')) {
      logger.warn('DB connection dropped, retrying query...');
      return await pool.query(text, params);
    }
    throw err;
  }
};

export const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_jobs (
      id          SERIAL PRIMARY KEY,
      job_id      TEXT NOT NULL UNIQUE,
      "to"        TEXT NOT NULL,
      subject     TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'queued',
      attempts    INTEGER DEFAULT 0,
      error       TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  logger.info('Database initialized');
};

export default pool;