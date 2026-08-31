import { installTelegramThrottle, retryAfterOf } from './telegram-throttle';

const silentLogger = { warn: jest.fn() } as unknown as { warn: jest.Mock };

function makeTarget(impl: jest.Mock) {
  const target = { callApi: impl as unknown as typeof target.callApi };
  installTelegramThrottle(target as never, {
    logger: silentLogger,
    chatGapMs: 60,
    globalGapMs: 0,
    maxRetries: 2,
  });
  return target;
}

describe('installTelegramThrottle', () => {
  it('разносит сообщения в один чат на паузу', async () => {
    const at: number[] = [];
    const target = makeTarget(jest.fn(async () => { at.push(Date.now()); return 'ok'; }));

    await Promise.all([
      target.callApi('sendMessage', { chat_id: -100, text: 'a' }),
      target.callApi('sendMessage', { chat_id: -100, text: 'b' }),
    ]);

    expect(at).toHaveLength(2);
    expect(at[1] - at[0]).toBeGreaterThanOrEqual(50);
  });

  it('не задерживает разные чаты друг из-за друга', async () => {
    const at: number[] = [];
    const target = makeTarget(jest.fn(async () => { at.push(Date.now()); return 'ok'; }));

    await Promise.all([
      target.callApi('sendMessage', { chat_id: 1, text: 'a' }),
      target.callApi('sendMessage', { chat_id: 2, text: 'b' }),
    ]);

    expect(at[1] - at[0]).toBeLessThan(50);
  });

  it('повторяет 429 по retry_after и отдаёт результат', async () => {
    const impl = jest
      .fn()
      .mockRejectedValueOnce({
        response: { error_code: 429, parameters: { retry_after: 0 } },
      })
      .mockResolvedValue('sent');
    const target = makeTarget(impl);

    await expect(
      target.callApi('sendMessage', { chat_id: -100, text: 'a' }),
    ).resolves.toBe('sent');
    expect(impl).toHaveBeenCalledTimes(2);
  });

  it('упавшая отправка не блокирует очередь чата', async () => {
    const impl = jest
      .fn()
      .mockRejectedValueOnce(new Error('chat not found'))
      .mockResolvedValue('sent');
    const target = makeTarget(impl);

    const first = target.callApi('sendMessage', { chat_id: -100, text: 'a' });
    const second = target.callApi('sendMessage', { chat_id: -100, text: 'b' });

    await expect(first).rejects.toThrow('chat not found');
    await expect(second).resolves.toBe('sent');
  });

  it('обычные ошибки не ретраятся', async () => {
    const impl = jest.fn().mockRejectedValue({ response: { error_code: 400 } });
    const target = makeTarget(impl);

    await expect(
      target.callApi('sendMessage', { chat_id: -100, text: 'a' }),
    ).rejects.toBeDefined();
    expect(impl).toHaveBeenCalledTimes(1);
  });

  it('retryAfterOf читает срок из ошибки telegraf', () => {
    expect(
      retryAfterOf({ response: { error_code: 429, parameters: { retry_after: 31 } } }),
    ).toBe(31);
    expect(retryAfterOf({ response: { error_code: 400 } })).toBeNull();
  });
});
