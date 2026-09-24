import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger, logError, logRequest, normalizeLogLevel } from './logger';

describe('logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes log levels', () => {
    expect(normalizeLogLevel('ERROR')).toBe('error');
    expect(normalizeLogLevel('invalid')).toBe('info');
    expect(normalizeLogLevel('debug')).toBe('debug');
  });

  it('logs success requests as info with structured fields', () => {
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined);

    logRequest(
      {
        requestId: 'req-123',
        method: 'POST',
        path: '/api/campaigns',
        status: 201,
        durationMs: 18.567,
      },
      'info',
    );

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const payload = infoSpy.mock.calls[0][0] as any;

    expect(payload).toMatchObject({
      event: 'http_request',
      requestId: 'req-123',
      method: 'POST',
      path: '/api/campaigns',
      status: 201,
      duration_ms: 18.57,
    });
    expect(payload.message).toContain('POST /api/campaigns 201');
  });

  it('logs client error requests as warn with structured fields', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    logRequest(
      {
        requestId: 'req-456',
        method: 'GET',
        path: '/api/not-found',
        status: 404,
        durationMs: 5.123,
      },
      'info',
    );

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const payload = warnSpy.mock.calls[0][0] as any;

    expect(payload).toMatchObject({
      event: 'http_request',
      requestId: 'req-456',
      method: 'GET',
      path: '/api/not-found',
      status: 404,
      duration_ms: 5.12,
    });
  });

  it('logs server error requests as error with structured fields', () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    logRequest(
      {
        requestId: 'req-789',
        method: 'POST',
        path: '/api/error',
        status: 500,
        durationMs: 12.345,
      },
      'info',
    );

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const payload = errorSpy.mock.calls[0][0] as any;

    expect(payload).toMatchObject({
      event: 'http_request',
      requestId: 'req-789',
      method: 'POST',
      path: '/api/error',
      status: 500,
      duration_ms: 12.35,
    });
  });

  it('logs errors with the message and stack', () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const err = new Error('Boom');

    logError(err, { event: 'request_error', path: '/api/campaigns', status: 500 }, 'info');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const payload = errorSpy.mock.calls[0][0] as any;

    expect(payload).toMatchObject({
      event: 'request_error',
      path: '/api/campaigns',
      status: 500,
    });
    expect(payload.err.message).toBe('Boom');
    expect(payload.err.stack).toContain('Boom');
    expect(payload.err.name).toBe('Error');
  });
});

describe('redactSensitive (issue #965)', () => {
  it('redacts authorization headers and tokens from dependency/log payloads', async () => {
    const { redactSensitive } = await import('./logger');
    const redacted = redactSensitive({
      authorization: 'Bearer secret-token',
      apiKey: 'abc',
      message: 'ok',
      nested: { privateKey: '0xdead', path: '/deps' },
    }) as Record<string, unknown>;
    expect(redacted.authorization).toBe('[REDACTED]');
    expect(redacted.apiKey).toBe('[REDACTED]');
    expect(redacted.message).toBe('ok');
    expect((redacted.nested as Record<string, unknown>).privateKey).toBe('[REDACTED]');
    expect((redacted.nested as Record<string, unknown>).path).toBe('/deps');
  });
});

