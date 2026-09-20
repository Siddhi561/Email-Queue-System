import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSend, ResendMock } = vi.hoisted(() => {
  const mockSend = vi.fn();

  class ResendMock {
    constructor() {
      this.emails = {
        send: mockSend,
      };
    }
  }

  process.env.RESEND_API_KEY = 'test_key';
  process.env.FROM_EMAIL = 'test@resend.dev';

  return {
    mockSend,
    ResendMock,
  };
});

vi.mock('resend', () => ({
  Resend: ResendMock,
}));

vi.mock('../../src/config/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { sendEmail } from '../../src/services/emailService.js';

describe('Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successful send → returns message data', async () => {
    mockSend.mockResolvedValue({
      data: { id: 'msg_abc' },
      error: null,
    });

    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      body: 'Hello',
    });

    expect(result.id).toBe('msg_abc');
  });

  it('Resend API error → throws with message', async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: {
        message: 'Invalid API key',
      },
    });

    await expect(
      sendEmail({
        to: 'x@x.com',
        subject: 'S',
        body: 'B',
      })
    ).rejects.toThrow('Email send failed: Invalid API key');
  });

  it('sends with correct HTML wrapping', async () => {
    mockSend.mockResolvedValue({
      data: { id: 'ok' },
      error: null,
    });

    await sendEmail({
      to: 'a@b.com',
      subject: 'Hi',
      body: 'My body',
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        html: '<p>My body</p>',
      })
    );
  });
});