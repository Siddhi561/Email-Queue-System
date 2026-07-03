<p align="center">

![Node.js](https://img.shields.io/badge/Node.js-22-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express)
![BullMQ](https://img.shields.io/badge/BullMQ-Job%20Queue-FF6B00?style=for-the-badge)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Resend](https://img.shields.io/badge/Resend-Email-000000?style=for-the-badge)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![REST API](https://img.shields.io/badge/API-REST-009688?style=for-the-badge)
![Production Ready](https://img.shields.io/badge/Production-Ready-success?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

</p>

<p align="center">
  <img src="docs/images/banner.png" width="100%">
</p>



# Email Queue System

A production-style background job system that queues and delivers emails asynchronously using BullMQ and Redis. Built to demonstrate how real backend systems handle background processing, retries, and failure tracking.

---

## Why This Exists

Sending emails directly in an API route is fragile. If the email provider is slow or down, your API hangs or fails. This system decouples email sending from the request-response cycle — the API responds instantly, and a background worker handles delivery independently with automatic retries.

---

## 🏗️ Architecture

<p align="center">
  <img src="docs/images/architecture.png" width="60%">
</p>

> Overall architecture showing API, BullMQ, Redis, PostgreSQL, Worker and Resend.


---

## ⚙️ Job Lifecycle

<p align="center">
  <img src="docs/images/job-lifecycle.png" width="60%">
</p>

> Complete lifecycle of an email request from API call to background processing, retries and completion.


---

## Tech Stack

| Tool | Purpose |
|---|---|
| Node.js 22 (ESM) | Runtime — uses native `import/export`, no CommonJS |
| Express | HTTP server |
| BullMQ | Job queue — handles retries, backoff, and priority |
| Redis (Docker) | Queue storage — BullMQ requires Redis 5+ |
| PostgreSQL (Neon) | Permanent job status tracking and audit trail |
| Resend | Email delivery API |
| Zod | Request validation with detailed error messages |
| Winston | Structured JSON logging |
| concurrently | Runs API and worker together in development |

---

## Features

- **Async email delivery** — API returns 202 immediately, email sent in background
- **Automatic retries** — exponential backoff: 5s → 25s → 125s (3 attempts)
- **Dead letter queue** — permanently failed jobs moved for manual review
- **Job prioritization** — priority 1 (urgent) processed before priority 10 (normal)
- **Redis rate limiting** — 5 requests per minute per IP, atomic Redis INCR counter
- **Worker concurrency** — processes up to 5 jobs simultaneously (I/O bound, safe with pool of 3 DB connections)
- **Job status tracking** — full history in PostgreSQL with timestamps and error messages
- **Structured logging** — every step logged with Winston in JSON format
- **Dashboard UI** — simple web interface to send emails and check status

---

## 🖥️ Dashboard

<p align="center">
  <img src="docs/images/dashboard.png" width="50%">
</p>

> Dashboard used to queue emails and monitor delivery status.
---


## Project Structure

## 📁 Project Structure

```
email-queue-system/
│
├── docs/
│   ├── images/
│   │   ├── banner.png                  # GitHub README banner
│   │   ├── architecture.png            # System architecture diagram
│   │   ├── job-lifecycle.png           # Email job lifecycle diagram
│   │   ├── dashboard.png               # Dashboard screenshot
│   │   ├── job-status.png              # Job status tracking
│   │   ├── postgres.png                # PostgreSQL records
│   │   ├── retry-timeline.png          # Exponential retry timeline
│   │   ├── worker-terminal.png         # Background worker logs
│   │   └── failure-retry.png           # Failed job & retry handling
│   │
│   └── postman/
│       └── Email Queue System.postman_collection.json
│
├── src/
│   ├── config/
│   │   ├── db.js                       # PostgreSQL connection & query wrapper
│   │   ├── logger.js                   # Winston structured logger
│   │   └── redis.js                    # Redis connection for BullMQ
│   │
│   ├── controllers/
│   │   └── emailController.js          # Queue email, create DB record & return HTTP 202
│   │
│   ├── middleware/
│   │   ├── asyncHandler.js             # Async error wrapper
│   │   ├── errorHandler.js             # Global error handling middleware
│   │   ├── rateLimiter.js              # Redis-based sliding window rate limiter
│   │   └── validate.js                 # Zod request validation
│   │
│   ├── queues/
│   │   └── emailQueue.js               # BullMQ queue & Dead Letter Queue configuration
│   │
│   ├── routes/
│   │   └── emailRoutes.js              # Email API endpoints
│   │
│   ├── services/
│   │   └── emailService.js             # Resend email integration
│   │
│   ├── workers/
│   │   └── emailWorker.js              # Background email processor
│   │
│   ├── public/
│   │   └── index.html                  # Demo dashboard
│   │
│   └── app.js                          # Express application entry point
│
├── .env.example                        # Environment variable template
├── .gitignore                          # Git ignore rules
├── LICENSE                             # MIT License
├── package.json                        # Project metadata & scripts
├── package-lock.json                   # Dependency lock file
└── README.md                           # Project documentation
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Docker — for running Redis 7 locally
- PostgreSQL database — [Neon](https://neon.tech) free tier works
- [Resend](https://resend.com) account — free tier allows sending to your own verified email

### Setup

```bash
# Clone and install
git clone https://github.com/Siddhi561/Email-Queue-System
cd email-queue-system
npm install

# Start Redis 7 via Docker (BullMQ requires Redis 5+)
docker run -d --name redis-queue -p 6379:6379 redis:7

# Configure environment — create .env file with the variables below
```

### Environment Variables

Create a `.env` file in the project root:

```env
PORT=5000
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:password@host/db?sslmode=require
RESEND_API_KEY=re_xxxxxxxxxxxx
FROM_EMAIL=onboarding@resend.dev
LOG_LEVEL=info
```

> Get your `DATABASE_URL` from the Neon dashboard. Use the **pooled** connection string (contains `-pooler` in the hostname).
> Get your `RESEND_API_KEY` from the Resend dashboard under API Keys.

### Available Scripts

```bash
npm run dev:all      # Start API + worker together (recommended for development)
npm run dev          # API server only
npm run dev:worker   # Background worker only
npm start            # Production — API only (no --watch)
npm run worker       # Production — worker only
```

### Run

```bash
npm run dev:all
```

You should see:
```
[0] info: Redis connected
[0] info: PostgreSQL connected
[0] info: Database initialized
[0] info: Server started { port: 5000 }
[1] info: Redis connected
[1] info: PostgreSQL connected
[1] info: Email worker started
```

`[0]` = API server logs | `[1]` = Worker logs

Open `http://localhost:5000` for the dashboard.

---

## API Reference

### POST /api/email/send

Queue an email for delivery. Rate limited to 5 requests per minute per IP.

**Request body:**
```json
{
  "to": "recipient@example.com",
  "subject": "Hello",
  "body": "Email content here",
  "priority": 10
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| to | string | yes | Valid email address |
| subject | string | yes | Min 1, max 200 characters |
| body | string | yes | Email body — rendered as HTML paragraph |
| priority | integer | no | 1–10, default 10. Lower = processed first |

**Priority guide:** `1` = urgent (password reset), `5` = high (order confirmation), `10` = normal (marketing)

**Response `202` — Accepted:**
```json
{
  "success": true,
  "message": "Email queued successfully",
  "jobId": "5",
  "priority": 10
}
```

**Response `400` — Validation failed:**
```json
{
  "success": false,
  "error": "Validation failed",
  "issues": [
    { "field": "to", "message": "Invalid email address" }
  ]
}
```

**Response `429` — Rate limited:**
```json
{
  "success": false,
  "error": "Too many requests",
  "retryAfter": 45
}
```

**Rate limit headers on every response:**
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 3
```

---
# 👷 Worker Process

<p align="center">
  <img src="docs/images/worker-terminal.png" alt="BullMQ Worker Terminal" width="50%">
</p>

<p align="center">
  <em>Background worker processing queued email jobs independently from the API server.</em>
</p>

---
# 📊 Job Status Tracking

<p align="center">
  <img src="docs/images/job-status.png" alt="Job Status Dashboard" width="50%">
</p>

<p align="center">
  <em>Track each email as it moves through the queue: Queued → Processing → Completed or Failed.</em>
</p>

---
# 🗄️ PostgreSQL Job Records

<p align="center">
  <img src="docs/images/postgres.png" alt="PostgreSQL Email Jobs Table" width="50%">
</p>

<p align="center">
  <em>Persistent storage of email jobs including recipient, status, retry count, timestamps, and processing metadata.</em>
</p>


---
# 🔄 Exponential Retry Timeline

<p align="center">
  <img src="docs/images/retry-timeline.png" alt="Retry Timeline" width="50%">
</p>

<p align="center">
  <em>Failed email deliveries are retried using exponential backoff before being moved to the Dead Letter Queue after the maximum retry limit.</em>
</p>

---
# ❌ Failure Handling

<p align="center">
  <img src="docs/images/failure-retry.png" alt="Failure Handling Dashboard" width="50%">
</p>

<p align="center">
  <em>When all retry attempts are exhausted, the job is marked as failed and moved to the Dead Letter Queue for further inspection.</em>
</p>

---

### GET /api/email/status/:jobId

Get current delivery status of an email job from PostgreSQL.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "job_id": "5",
    "to": "recipient@example.com",
    "subject": "Hello",
    "status": "completed",
    "attempts": 1,
    "error": null,
    "created_at": "2026-04-17T10:51:33.961Z",
    "updated_at": "2026-04-17T10:51:36.451Z"
  }
}
```

**Status lifecycle:** `queued` → `processing` → `completed` or `failed`

When `status` is `failed`, the `error` field contains the error message from the last failed attempt.

**Response `404`:**
```json
{ "success": false, "error": "Job not found" }
```

---

### GET /health

```json
{ "status": "ok", "timestamp": "2026-04-17T10:44:54.150Z" }
```

---

## Key Design Decisions

**Why a separate worker process?**
The API and worker run as independent Node.js processes. If the worker crashes, the API keeps serving requests — they fail independently. In production they'd run on separate machines and scale independently — you might run 1 API server and 5 worker instances during high email volume.

**Why PostgreSQL AND Redis?**
Redis (via BullMQ) is temporary, in-memory storage optimized for queue operations. If Redis is flushed, all queue history is gone. PostgreSQL is permanent and queryable — it answers questions like "how many emails failed in the last 24 hours?" that Redis cannot. Both serve different purposes and are both needed.

**Why 202 instead of 200?**
202 means "accepted, processing in background." 200 means "done." Since the email hasn't been sent at response time — only queued — returning 200 would be semantically incorrect. 202 is the right HTTP status for async operations.

**Why exponential backoff?**
If Resend is down, retrying every second makes recovery harder by hammering an already struggling service. Exponential backoff (5s → 25s → 125s) gives Resend time to recover and reduces unnecessary load on your own system during a failure.

**Why `maxRetriesPerRequest: null` in Redis config?**
BullMQ holds Redis connections open in blocking mode to wait for jobs. Without this setting, ioredis throws when a blocking command times out. Setting it to `null` tells ioredis to wait indefinitely, which BullMQ requires.

**Why insert PostgreSQL row before adding to queue?**
If you add to the queue first and the DB insert fails, the worker picks up a job with no record to update — an orphaned job. Writing to DB first guarantees the row exists before the worker ever touches it.

---

## Common Issues

| Error | Cause | Fix |
|---|---|---|
| `Redis version needs to be >= 5.0.0` | Windows native Redis (v3) is running on port 6379, blocking Docker Redis | Run `net stop Redis` in admin CMD, then restart Docker Redis |
| `ECONNREFUSED on PostgreSQL` | `DATABASE_URL` missing or using localhost instead of Neon URL | Check `.env` and paste the connection string from Neon dashboard |
| `Missing API key` for Resend | Running `node src/...` directly instead of `npm run` — `.env` not loaded | Always use `npm run dev:worker`, never run node directly |
| `duplicate key value violates unique constraint` | Old test rows with placeholder job_id still in DB | Run `TRUNCATE TABLE email_jobs` in TablePlus or Neon SQL editor |
| Status stuck on `processing` | Worker using wrong ID to update PostgreSQL row | Worker must use `job.id` (BullMQ ID), not `job.data.jobId` (DB row ID) |

---

## What I Would Add in Production

- **Idempotency** — store Resend message ID after first send, check before retrying to prevent duplicate emails
- **Metrics** — track queue depth, processing time, and failure rate with Prometheus/Grafana
- **Email templates** — Handlebars or MJML templates instead of raw body strings
- **API authentication** — require API key on the send endpoint before rate limiting
- **Dead letter review UI** — admin interface to inspect and re-queue permanently failed jobs
- **Unsubscribe handling** — check suppression list before queuing




## License

MIT License — see [LICENSE](LICENSE) for details.


## 👨‍💻 Author

Built as a backend engineering portfolio project demonstrating scalable job queues, BullMQ workers, Redis-based rate limiting, retry strategies, and production-ready API architecture.

If you found this project useful, consider giving it a ⭐.