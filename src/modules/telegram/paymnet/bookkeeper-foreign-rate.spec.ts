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
