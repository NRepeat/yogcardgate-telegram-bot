import { Logger } from '@nestjs/common';

/**
 * Троттлинг вызовов Telegram Bot API.
 *
 * Заявки приходят пачками (вендор заливает по два десятка за секунду), оператор
 * принимает их подряд, и на каждую бот шлёт сообщение в рабочую группу плюс
 * правит карточки воркеров. Telegram отвечает 429 на ~20-м сообщении в группу
 * за минуту, а сцена принятия трактует это как «не смогли уведомить» и
 * откатывает уже принятую заявку — её тут же перехватывает другой оператор.
 *
 * Чиним в одной точке: подменяем `callApi` у telegraf, через который проходят
 * все вызовы (sendPhoto, editMessageCaption, …). Очередь на чат выдерживает
 * паузу между сообщениями, 429 повторяется по `retry_after`.
 */

/** Telegram: ~30 запросов в секунду на бота. */
const GLOBAL_GAP_MS = 40;
/** Telegram: ~20 сообщений в минуту в одну группу. */
const CHAT_GAP_MS = 3_000;
const MAX_RETRIES = 5;

/** Методы, которые расходуют лимит сообщений чата; правки идут вне очереди. */
const CHAT_METHODS = new Set([
  'sendMessage',
  'sendPhoto',
  'sendDocument',
  'sendVideo',
  'sendAnimation',
  'sendMediaGroup',
  'copyMessage',
  'forwardMessage',
]);

type CallApi = (method: string, payload?: Record<string, unknown>) => Promise<unknown>;

type ThrottleTarget = { callApi: CallApi; __throttled?: boolean };

export type ThrottleOptions = {
  logger?: Pick<Logger, 'warn'>;
  chatGapMs?: number;
  globalGapMs?: number;
  maxRetries?: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** `retry_after` из ошибки telegraf; null — ошибка не про лимит. */
export function retryAfterOf(error: unknown): number | null {
  const err = error as {
    response?: { error_code?: number; parameters?: { retry_after?: number } };
    parameters?: { retry_after?: number };
    code?: number;
  };
  const seconds =
    err?.response?.parameters?.retry_after ?? err?.parameters?.retry_after;
  if (typeof seconds === 'number') return seconds;
  return err?.response?.error_code === 429 || err?.code === 429 ? 1 : null;
}

export function installTelegramThrottle(
  telegram: ThrottleTarget,
  options: ThrottleOptions = {},
): void {
  if (telegram.__throttled) return;
  telegram.__throttled = true;

  const logger = options.logger ?? new Logger('TelegramThrottle');
  const chatGapMs = options.chatGapMs ?? CHAT_GAP_MS;
  const globalGapMs = options.globalGapMs ?? GLOBAL_GAP_MS;
  const maxRetries = options.maxRetries ?? MAX_RETRIES;

  const callApi = telegram.callApi.bind(telegram);
  const chatChain = new Map<string, Promise<unknown>>();
  const chatReadyAt = new Map<string, number>();
  let globalReadyAt = 0;

  const callGlobal = async (method: string, payload: Record<string, unknown>) => {
    const wait = globalReadyAt - Date.now();
    globalReadyAt = Math.max(Date.now(), globalReadyAt) + globalGapMs;
    if (wait > 0) await sleep(wait);
    return callApi(method, payload);
  };

  const callWithRetry = async (
    method: string,
    payload: Record<string, unknown>,
  ) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await callGlobal(method, payload);
      } catch (error) {
        const retryAfter = retryAfterOf(error);
        if (retryAfter === null || attempt >= maxRetries) throw error;
        logger.warn(
          `${method}: лимит Telegram, повтор через ${retryAfter}с (попытка ${attempt + 1}/${maxRetries})`,
        );
        // Секунда сверху: Telegram отдаёт срок с округлением вниз.
        await sleep((retryAfter + 1) * 1000);
      }
    }
  };

  telegram.callApi = (method: string, payload: Record<string, unknown> = {}) => {
    const chatId = payload?.chat_id;
    if (chatId === undefined || chatId === null || !CHAT_METHODS.has(method)) {
      return callWithRetry(method, payload);
    }

    const key = String(chatId);
    const previous = chatChain.get(key) ?? Promise.resolve();
    const run = previous
      .catch(() => undefined)
      .then(async () => {
        const wait = (chatReadyAt.get(key) ?? 0) - Date.now();
        if (wait > 0) await sleep(wait);
        chatReadyAt.set(key, Date.now() + chatGapMs);
        return callWithRetry(method, payload);
      });

    // В цепочке держим «проглоченную» версию: одна упавшая отправка не должна
    // ронять следующие в очереди сообщения того же чата.
    chatChain.set(
      key,
      run.catch(() => undefined),
    );
    return run;
  };
}
