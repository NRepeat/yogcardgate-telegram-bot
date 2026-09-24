import PaymentWizard from './paymnet.scene';
import { TelegramController } from '../telegram.controller';
import { findForeignCloseSession, localSession } from 'src/session.store';

/**
 * Деньги: бухгалтер закрывает заявку, которую ведёт другой оператор. Сессии
 * разложены по ключу `chat:user`, поэтому чужой шаг ищется в сторе — тест
 * держит и поиск, и то, что выплата остаётся за оператором.
 */
const seed = (rows: Array<{ id: string; data: unknown }>) => {
  (localSession as any).DB = {
    get: () => ({ value: () => rows }),
  };
};

const closeRow = (id: string, stage: string) => ({
  id,
  data: {
    __scenes: {
      state: { requestId: 'r1', closeStage: stage, closeAccount: 'okx' },
    },
    messagesToDelete: [],
  },
});

describe('findForeignCloseSession', () => {
  it('берёт чужой открытый шаг в этом чате, свой и чужие чаты — мимо', () => {
    seed([
      closeRow('-100:555', 'rate'), // другой чат
      closeRow('-1:777', 'rate'), // сам бухгалтер
      closeRow('-1:555', 'rate'), // он и нужен
    ]);
    const found = findForeignCloseSession(-1, 777, ['rate', 'order']);
    expect(found?.key).toBe('-1:555');
    expect(found?.operatorTgId).toBe(555);
  });

  it('во время сверки не вмешиваемся', () => {
    seed([closeRow('-1:555', 'checking')]);
    expect(findForeignCloseSession(-1, 777, ['rate', 'order'])).toBeNull();
  });

  it('визард без шага закрытия — не наш случай', () => {
    seed([{ id: '-1:555', data: { __scenes: {} } }]);
    expect(findForeignCloseSession(-1, 777, ['rate', 'order'])).toBeNull();
  });
});

describe('курс бухгалтера в чужом визарде', () => {
  const makeController = (closeForeignWithRate: jest.Mock) =>
    new TelegramController(
      {} as never,
      {} as never,
      { get: jest.fn(() => '777') } as never,
      { closeForeignWithRate } as never,
    );

  const makeCtx = (text: string, fromId = 777) => ({
    message: { text, message_id: 1 },
    chat: { id: -1 },
    from: { id: fromId },
    session: {},
    reply: jest.fn(async () => ({ message_id: 2 })),
  });

  it('бухгалтер закрывает чужой шаг курса', async () => {
    seed([closeRow('-1:555', 'rate')]);
    const close = jest.fn(async () => true);
    const ctx = makeCtx('41,25');
    await makeController(close).on(ctx as never);
    expect(close).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ operatorTgId: 555 }),
      '41.25',
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('41.25'));
  });

  it('не-бухгалтер чужую заявку не трогает', async () => {
    seed([closeRow('-1:555', 'rate')]);
    const close = jest.fn();
    await makeController(close).on(makeCtx('41.25', 999) as never);
    expect(close).not.toHaveBeenCalled();
  });

  it('на шаге ордера длинное число — ID ордера, а не курс', async () => {
    seed([closeRow('-1:555', 'order')]);
    const close = jest.fn();
    const ctx = makeCtx('1234567');
    await makeController(close).on(ctx as never);
    expect(close).not.toHaveBeenCalled();
    // молчим: чужой ID ордера сверяется ключами оператора, не нашими
    expect(ctx.reply).not.toHaveBeenCalled();

    const manual = makeCtx('курс 41.25');
    const close2 = jest.fn(async () => true);
    await makeController(close2).on(manual as never);
    expect(close2).toHaveBeenCalledWith(manual, expect.anything(), '41.25');
  });

  it('«курс 41» без открытого визарда — молчим', async () => {
    seed([]);
    const close = jest.fn();
    const ctx = makeCtx('курс 41');
    await makeController(close).on(ctx as never);
    expect(close).not.toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('обычная болтовня в группе — молчим', async () => {
    seed([closeRow('-1:555', 'rate')]);
    const close = jest.fn();
    const ctx = makeCtx('Птаха');
    await makeController(close).on(ctx as never);
    expect(close).not.toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('свой открытый визард — закрываем его, а не чужой', async () => {
    seed([closeRow('-1:555', 'rate')]);
    const close = jest.fn();
    const ctx = {
      ...makeCtx('41.25'),
      session: { __scenes: { state: { closeStage: 'rate' } } },
    };
    await makeController(close).on(ctx as never);
    expect(close).not.toHaveBeenCalled();
  });
});

/**
 * Деньги: сам порядок «сначала запись, потом чтение» теперь живёт в
 * TelegramService.completeRequestAndRefreshCards и проверяется там же
 * (telegram.service.complete.spec.ts). Здесь — что визард отдаёт туда всё
 * нужное: заявку, оператора, квитанцию и поля закрытия.
 */
describe('finishClose: визард делегирует закрытие общему методу', () => {
  it('в общий метод уходят оператор, квитанция и площадка с курсом', async () => {
    const requestService = {
      closeFeeFor: jest.fn(async () => '0.1'),
    };
    const completeRequestAndRefreshCards = jest.fn(
      async (_id: string, _opts: any) => undefined,
    );
    const telegramService = { completeRequestAndRefreshCards };
    const leave = jest.fn();
    const wizard = new PaymentWizard(
      telegramService as never,
      {} as never,
      { telegram: { editMessageText: jest.fn(async () => ({})) } } as never,
      { get: jest.fn(() => '777') } as never,
      requestService as never,
      {} as never,
    );

    const ctx = {
      wizard: {
        state: {
          requestId: 'r1',
          paymentPhotos: [{ file_id: 'p1' }],
          closeStage: 'rate',
          closeAccount: 'okx',
          closePromptId: 10,
        },
      },
      session: { messagesToDelete: [], requestMenuMessageId: [] },
      chat: { id: -1 },
      from: { id: 777 },
      message: { text: '46.21', message_id: 1 },
      reply: jest.fn(async () => ({ message_id: 2 })),
      scene: { leave },
    };
    await wizard.proceedFinalStep(ctx as never);

    expect(completeRequestAndRefreshCards).toHaveBeenCalledTimes(1);
    const [requestId, opts] = completeRequestAndRefreshCards.mock.calls[0];
    expect(requestId).toBe('r1');
    expect(opts.actorTgId).toBe(777);
    // Одна квитанция едет file_id: заново её заливать незачем.
    expect(opts.receipt.fileId).toBe('p1');
    expect(opts.close).toMatchObject({ account: 'okx', rate: '46.21' });
    expect(leave).toHaveBeenCalled();
  });
});
