import PaymentWizard, { CHECKING_CANCEL_LOCK_MS } from './paymnet.scene';
import { UtilsService } from 'src/modules/utils/utils.service';
import { CloseWatchdogService } from '../close-watchdog.service';
import { findStuckCheckingSessions } from 'src/session.store';

jest.mock('src/session.store', () => ({
  findForeignCloseSession: jest.fn(),
  saveForeignSession: jest.fn(async () => undefined),
  findStuckCheckingSessions: jest.fn(),
}));

const econnreset = () =>
  Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } });

describe('downloadTelegramPhoto retry', () => {
  afterEach(() => jest.restoreAllMocks());

  it('succeeds after one ECONNRESET', async () => {
    const ok = (body: Buffer | string) => ({
      ok: true,
      arrayBuffer: async () => Uint8Array.from(Buffer.from(body)).buffer,
    });
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(econnreset())
      .mockResolvedValueOnce(ok(JSON.stringify({ result: { file_path: 'a.jpg' } })))
      .mockResolvedValueOnce(ok('IMG'));
    global.fetch = fetchMock as never;
    const utils = new UtilsService({} as never, {} as never, {} as never, {} as never);
    const buf = await utils.downloadTelegramPhoto('t', 'f');
    expect(buf.toString()).toBe('IMG');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

function makeWizard(overrides: Record<string, unknown> = {}) {
  const bot = {
    telegram: {
      editMessageText: jest.fn(async () => ({})),
      editMessageMedia: jest.fn(async () => ({})),
    },
  };
  const requestService = {
    findById: jest.fn(async () => ({ id: 'r1', amount: 1000, rate: 40 })),
    getAllPublicMessagesWithRequestsId: jest.fn(async () => []),
  };
  const utils = {
    downloadTelegramPhoto: jest.fn(async () => {
      throw econnreset();
    }),
  };
  const wizard = new PaymentWizard(
    {} as never,
    (overrides.utils ?? utils) as never,
    bot as never,
    { get: () => 'token' } as never,
    requestService as never,
    {
      verify: jest.fn(async () => ({ ok: true, rate: '41', fee: '0' })),
    } as never,
  );
  return { wizard, bot, requestService };
}

const photo = (id: string) => ({ file_id: id });
const makeCtx = (state: object, extra: object = {}) => ({
  wizard: { state },
  session: { messagesToDelete: [], requestMenuMessageId: [] },
  chat: { id: 1 },
  from: { id: 777 },
  answerCbQuery: jest.fn(),
  scene: { leave: jest.fn() },
  reply: jest.fn(async () => ({ message_id: 2 })),
  ...extra,
});

describe('close wizard resilience', () => {
  it('download failure after retries returns stage to order', async () => {
    const { wizard, bot } = makeWizard();
    const state = {
      requestId: 'r1',
      paymentPhotos: [photo('a'), photo('b')],
      closeStage: 'order',
      closeAccount: 'binance',
      closePromptId: 10,
    } as { closeStage: string; checkingSince?: number };
    const ctx = makeCtx(state, { message: { text: '1234567', message_id: 1 } });
    await wizard.proceedFinalStep(ctx as never);
    expect(state.closeStage).toBe('order');
    expect(state.checkingSince).toBeUndefined();
    expect(bot.telegram.editMessageText).toHaveBeenLastCalledWith(
      1,
      10,
      undefined,
      expect.stringContaining('Сбой сети'),
      expect.anything(),
    );
    expect(ctx.scene.leave).not.toHaveBeenCalled();
  });

  const cancelCtx = (state: object) =>
    makeCtx(state, {
      message: undefined,
      callbackQuery: { data: 'cancel_payment_photo_proceed' },
    });

  it('cancel after the lock timeout leaves the scene', async () => {
    const { wizard } = makeWizard();
    const state = {
      requestId: 'r1',
      messageId: 5,
      closeStage: 'checking',
      checkingSince: Date.now() - CHECKING_CANCEL_LOCK_MS - 1000,
    };
    const ctx = cancelCtx(state);
    await wizard.proceedFinalStep(ctx as never);
    expect(ctx.scene.leave).toHaveBeenCalled();
  });

  it('cancel inside the lock window is refused', async () => {
    const { wizard } = makeWizard();
    const ctx = cancelCtx({ requestId: 'r1', closeStage: 'checking', checkingSince: Date.now() });
    await wizard.proceedFinalStep(ctx as never);
    expect(ctx.scene.leave).not.toHaveBeenCalled();
  });

  it('"message is not modified" does not block leaving', async () => {
    const { wizard, bot } = makeWizard();
    bot.telegram.editMessageMedia.mockRejectedValue(
      new Error('400: Bad Request: message is not modified'),
    );
    const ctx = cancelCtx({ requestId: 'r1', messageId: 5, closeStage: 'order' });
    await wizard.proceedFinalStep(ctx as never);
    expect(ctx.scene.leave).toHaveBeenCalled();
  });
});

describe('CloseWatchdogService', () => {
  it('resets an old checking session and notifies the admin chat', async () => {
    const { wizard, bot } = makeWizard();
    const state = {
      requestId: 'r1',
      closeStage: 'checking',
      closeAccount: 'binance',
      closePromptId: 10,
      checkingSince: Date.now() - 10 * 60_000,
    } as { closeStage: string };
    (findStuckCheckingSessions as jest.Mock).mockReturnValue([
      { key: '-100:777', operatorTgId: 777, data: {}, state },
    ]);
    const sendMessage = jest.fn(async () => ({}));
    const watchdog = new CloseWatchdogService(
      { telegram: { sendMessage } } as never,
      { get: () => '999' } as never,
      wizard,
    );
    await watchdog.sweep();
    expect(state.closeStage).toBe('order');
    expect(bot.telegram.editMessageText).toHaveBeenCalledWith(
      -100,
      10,
      undefined,
      expect.stringContaining('Сбой сети'),
      expect.anything(),
    );
    expect(sendMessage).toHaveBeenCalledWith('999', expect.stringContaining('r1'));
  });
});
