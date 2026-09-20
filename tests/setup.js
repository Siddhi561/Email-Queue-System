import { vi } from 'vitest';


vi.mock('../src/config/db.js', () => ({
  query: vi.fn(),
  initDB: vi.fn().mockResolvedValue(undefined),
  default: { query: vi.fn() },
}));

vi.mock('../src/config/redis.js', () => ({
  default: {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(30),
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    ping: vi.fn().mockResolvedValue('PONG'),
  },
}));

vi.mock('../src/queues/emailQueue.js', () => ({
  addEmailJob: vi.fn(),
  moveToDeadLetter: vi.fn(),
  default: { on: vi.fn() },
}));