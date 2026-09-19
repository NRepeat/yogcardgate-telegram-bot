import PaymentWizard, {
  isBookkeeperId,
  parseCloseNum,
  parseOrderIds,
} from './paymnet.scene';

/** Деньги: запятая оператора не должна валить шаг, мусор не должен пройти. */
describe('parseCloseNum', () => {
  it('нормализует ввод оператора', () => {
    expect(parseCloseNum(' 41,25 ')).toBe('41.25');
    expect(parseCloseNum('41.25')).toBe('41.25');
  });

  it('ноль и мусор — не курс', () => {
    expect(parseCloseNum('0')).toBeNull();
    expect(parseCloseNum('-1')).toBeNull();
    expect(parseCloseNum('41.2.5')).toBeNull();
    expect(parseCloseNum('сорок')).toBeNull();
    expect(parseCloseNum('')).toBeNull();
  });
});

/**
 * Деньги: во время await verify стадия должна быть транзитной ('checking'),
 * иначе отмена/повторный ввод бегут параллельно со сверкой и заявка
 * закрывается уже после отмены.
 */
describe('closeStage во время сверки', () => {
  it('checking блокирует отмену, неуспех возвращает order', async () => {
    let resolveVerify!: (v: unknown) => void;
    const verify = jest.fn(() => new Promise((res) => (resolveVerify = res)));
    const requestService = {
      findById: jest.fn(async () => ({ id: 'r1', amount: 1000, rate: 40 })),
    };
    const bot = { telegram: { editMessageText: jest.fn(async () => ({})) } };
    const wizard = new PaymentWizard(
      {} as never,
      {} as never,
      bot as never,
      {} as never,
      requestService as never,
      { verify } as never,
    );

    const state = {
      requestId: 'r1',
      paymentPhotos: [],
      closeStage: 'order',
      closeAccount: 'binance',
      closePromptId: 10,
    };
    const baseCtx = {
      wizard: { state },
      session: { messagesToDelete: [], requestMenuMessageId: [] },
      chat: { id: 1 },
      from: { id: 777 },
      answerCbQuery: jest.fn(),
      scene: { leave: jest.fn() },
      reply: jest.fn(async () => ({ message_id: 2 })),
    };

    // оператор шлёт ID ордера — визард уходит в await verify
    const orderCtx = {
      ...baseCtx,
      message: { text: '1234567', message_id: 1 },
    };
    const inFlight = wizard.proceedFinalStep(orderCtx as never);
    while (verify.mock.calls.length === 0) await Promise.resolve();
    expect(state.closeStage).toBe('checking');
    // сверка идёт по площадке и по тому, кто закрывает: чужими ключами
    // ордер либо не найдётся, либо найдётся чужой
    expect(verify).toHaveBeenCalledWith(
      'r1',
      // список: закрытие частями идёт одним запросом, одиночный ордер — список из одного
      ['1234567'],
      expect.any(String),
      'binance',
      777,
      // сумма заявки в фиате — основная сверка: крипта в ордере считается по
      // курсу оператора, а в заявке по курсу клиента, и сходиться не обязана
      '1000',
      expect.any(String),
    );

    // отмена во время сверки — «подождите», сцена жива, карточка не трогается
    const cancelCtx = {
      ...baseCtx,
      message: undefined,
      callbackQuery: { data: 'cancel_payment_photo_proceed' },
    };
    await wizard.proceedFinalStep(cancelCtx as never);
    expect(cancelCtx.answerCbQuery).toHaveBeenCalledWith(
      expect.stringContaining('сверка'),
    );
    expect(cancelCtx.scene.leave).not.toHaveBeenCalled();

    // сверка не прошла — возвращаемся к вводу ордера
    resolveVerify({ ok: false, message: 'не сходится' });
    await inFlight;
    expect(state.closeStage).toBe('order');
  });
});

/** Деньги: ручной курс минует сверку — вводить может только бухгалтер из env. */
describe('гард бухгалтера', () => {
  it('пускает только id из BOOKKEEPER_TG_IDS, пустой env — никого', () => {
    expect(isBookkeeperId(111, '111,222')).toBe(true);
    expect(isBookkeeperId(222, ' 111 , 222 ')).toBe(true);
    expect(isBookkeeperId(999, '111,222')).toBe(false);
    expect(isBookkeeperId(111, '')).toBe(false);
    expect(isBookkeeperId(111, undefined)).toBe(false);
    expect(isBookkeeperId(undefined, '111')).toBe(false);
    // "11" не должен проходить как префикс "111"
    expect(isBookkeeperId(11, '111')).toBe(false);
  });

  const makeCtx = (state: Record<string, unknown>, text: string) => ({
    wizard: { state },
    from: { id: 999 }, // не бухгалтер
    chat: { id: 1 },
    session: { messagesToDelete: [], requestMenuMessageId: [] },
    message: { text, message_id: 1 },
    reply: jest.fn(() => Promise.resolve({ message_id: 2 })),
    scene: { leave: jest.fn() },
  });

  it('не-бухгалтер: курс для OKX и «курс N» у Binance блокируются, шаг не меняется', async () => {
    const closeFeeFor = jest.fn();
    const verify = jest.fn();
    const wizard = new PaymentWizard(
      {} as never,
      {} as never,
      {} as never,
      { get: jest.fn(() => '111,222') } as never,
      { closeFeeFor } as never,
      { verify } as never,
    );

    const rateState = {
      requestId: 'r1',
      paymentPhotos: [],
      closeStage: 'rate',
      closeAccount: 'okx',
    };
    const rateCtx = makeCtx(rateState, '41.25');
    await wizard.proceedFinalStep(rateCtx as never);
    expect(rateState.closeStage).toBe('rate');
    expect(closeFeeFor).not.toHaveBeenCalled();
    expect(rateCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining('бухгалтер'),
    );

    const orderState = {
      requestId: 'r1',
      paymentPhotos: [],
      closeStage: 'order',
      closeAccount: 'binance',
    };
    const orderCtx = makeCtx(orderState, 'курс 41.25');
    await wizard.proceedFinalStep(orderCtx as never);
    expect(orderState.closeStage).toBe('order');
    expect(verify).not.toHaveBeenCalled();
    expect(closeFeeFor).not.toHaveBeenCalled();
    expect(orderCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining('бухгалтер'),
    );
  });
});

/** Партнёр закрытия вводится оператором руками — имя из заявки не подставляем. */
describe('закрытие по партнёру', () => {
  const makeWizard = () => {
    const wizard = new PaymentWizard(
      {} as never,
      {} as never,
      { telegram: { editMessageText: jest.fn(async () => ({})) } } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const state: Record<string, unknown> = {
      requestId: 'r1',
      paymentPhotos: [],
      closeStage: 'account',
      closePromptId: 10,
    };
    const ctx = {
      wizard: { state },
      session: { messagesToDelete: [], requestMenuMessageId: [] },
      chat: { id: 1 },
      from: { id: 777 },
      answerCbQuery: jest.fn(),
      editMessageReplyMarkup: jest.fn(async () => ({})),
      reply: jest.fn(async () => ({ message_id: 2 })),
      callbackQuery: { data: 'close_acc_partner' },
    };
    return { wizard, state, ctx };
  };

  it('кнопка «Партнёр» ведёт на ручной ввод имени', async () => {
    const { wizard, state, ctx } = makeWizard();
    await wizard.proceedFinalStep(ctx as never);
    expect(state.closeAccount).toBeUndefined();
    expect(state.closeStage).toBe('partner');
  });
});

/**
 * Закрытие частями: несколько ID в одном сообщении. Сумму сверяет
 * exchange-check (допуск 5%), бот отвечает за разбор ввода.
 */
describe('parseOrderIds', () => {
  it('разбирает один и несколько ID, дубли схлопывает', () => {
    expect(parseOrderIds('12345678')).toEqual(['12345678']);
    expect(parseOrderIds(' 12345678  87654321 ')).toEqual(['12345678', '87654321']);
    expect(parseOrderIds('12345678,87654321')).toEqual(['12345678', '87654321']);
    expect(parseOrderIds('12345678\n87654321')).toEqual(['12345678', '87654321']);
    // список из заметок: нумерация и маркеры — оформление, не номера
    expect(parseOrderIds('1. 12345678\n2. 87654321')).toEqual(['12345678', '87654321']);
    expect(parseOrderIds('- 12345678\n- 87654321')).toEqual(['12345678', '87654321']);
    expect(parseOrderIds('№12345678 #87654321')).toEqual(['12345678', '87654321']);
    // повтор того же номера не должен удваивать сумму
    expect(parseOrderIds('12345678 12345678')).toEqual(['12345678']);
  });

  it('курс и мусор — не ID', () => {
    expect(parseOrderIds('44.12')).toBeNull();
    expect(parseOrderIds('курс 44')).toBeNull();
    expect(parseOrderIds('12345678 44.12')).toBeNull();
    expect(parseOrderIds('')).toBeNull();
  });
});

/**
 * Кнопку закрытия жмёт не владелец визарда: сессии по `chat:user`, апдейт в
 * сцену не попадает. Без моста такой апдейт пропадал молча — кнопка висела.
 */
describe('кнопка закрытия из чужой сессии', () => {
  it('двигает шаг оператора и сохраняет его сессию', async () => {
    const store = require('src/session.store');
    const data = {
      __scenes: {
        current: 'payment_photo_proceed',
        state: { requestId: 'r1', closeStage: 'account', closePromptId: 10 },
      },
    };
    const find = jest
      .spyOn(store, 'findForeignCloseSession')
      .mockReturnValue({
        key: '-100:777',
        operatorTgId: 777,
        data,
        state: data.__scenes.state,
      });
    const save = jest
      .spyOn(store, 'saveForeignSession')
      .mockResolvedValue(undefined);

    const bot = { telegram: { editMessageText: jest.fn(async () => ({})) } };
    const wizard = new PaymentWizard(
      {} as never,
      {} as never,
      bot as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const ctx = {
      chat: { id: -100 },
      from: { id: 555 },
      callbackQuery: { data: 'close_acc_binance' },
      answerCbQuery: jest.fn(),
      reply: jest.fn(async () => ({ message_id: 2 })),
      session: { requestMenuMessageId: [] },
    };

    await expect(wizard.handleForeignCloseCallback(ctx as never)).resolves.toBe(
      true,
    );
    expect(data.__scenes.state.closeStage).toBe('order');
    expect((data.__scenes.state as any).closeAccount).toBe('binance');
    expect(ctx.answerCbQuery).toHaveBeenCalled();
    expect(save).toHaveBeenCalledWith('-100:777', data);

    // закрывать в чате нечего — кнопка не наша, глобальный обработчик идёт дальше
    find.mockReturnValue(null);
    await expect(wizard.handleForeignCloseCallback(ctx as never)).resolves.toBe(
      false,
    );
    find.mockRestore();
    save.mockRestore();
  });
});
