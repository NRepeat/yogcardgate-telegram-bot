import { HttpException } from '@nestjs/common';
import { RequestCompleteController } from './request-complete.controller';

/**
 * Эндпоинт трогает деньги: ставит COMPLETED и тем самым отправляет заявку в
 * партнёрский отчёт. Проверяем ровно то, из-за чего партнёр увидит лишнее или
 * не увидит нужное — повтор, авторство выплаты и склейку квитанций.
 */
describe('RequestCompleteController', () => {
  const make = (request: any) => {
    const complete = jest.fn(async (_id: string, _opts: any) => {});
    const merge = jest.fn(async (images: Buffer[]) => images[0]);
    const closeFeeFor = jest.fn(async () => '0.15');
    let current = request;
    const requestService = {
      findById: jest.fn(async () => current),
      closeFeeFor,
    };
    const controller = new RequestCompleteController(
      requestService as never,
      { completeRequestAndRefreshCards: complete } as never,
      { mergeImagesGrid: merge } as never,
    );
    return {
      controller,
      complete,
      merge,
      closeFeeFor,
      finish: (next: any) => (current = next),
    };
  };

  const accepted = {
    id: 'req1',
    status: 'ACCEPTED',
    activeUser: { telegramId: BigInt(777) },
    message: [{}, {}, {}],
  };
  const png = (n: number) =>
    ({ buffer: Buffer.from(`img${n}`), mimetype: 'image/png' }) as never;

  it('404 на несуществующую заявку', async () => {
    const { controller } = make(null);
    await expect(controller.complete('nope', [], {})).rejects.toThrow(
      HttpException,
    );
  });

  it('повторное закрытие отбивается — иначе заявка уедет в отчёт дважды', async () => {
    const { controller, complete } = make({
      ...accepted,
      status: 'COMPLETED',
      completedAt: new Date('2026-09-24T12:00:00Z'),
    });
    await expect(controller.complete('req1', [], {})).rejects.toThrow(
      /уже закрыта/,
    );
    expect(complete).not.toHaveBeenCalled();
  });

  it('выплата по умолчанию числится за тем, кто вёл заявку', async () => {
    const { controller, complete } = make(accepted);
    await controller.complete('req1', [], {});
    expect(complete.mock.calls[0][1]).toMatchObject({ actorTgId: 777 });
  });

  it('actorTgId из тела перебивает оператора заявки', async () => {
    const { controller, complete } = make(accepted);
    await controller.complete('req1', [], { actorTgId: '999' });
    expect(complete.mock.calls[0][1]).toMatchObject({ actorTgId: 999 });
  });

  it('заявка без оператора и без actorTgId — 400, а не выплата в никуда', async () => {
    const { controller, complete } = make({ ...accepted, activeUser: null });
    await expect(controller.complete('req1', [], {})).rejects.toThrow(
      /actorTgId/,
    );
    expect(complete).not.toHaveBeenCalled();
  });

  it('несколько квитанций склеиваются в одну картинку', async () => {
    const { controller, merge, complete } = make(accepted);
    await controller.complete('req1', [png(1), png(2)], {});
    expect(merge).toHaveBeenCalledWith([
      Buffer.from('img1'),
      Buffer.from('img2'),
    ]);
    expect(complete.mock.calls[0][1].receipt).toBeDefined();
  });

  it('без картинок квитанция не придумывается', async () => {
    const { controller, merge, complete } = make(accepted);
    await controller.complete('req1', [], {});
    expect(merge).not.toHaveBeenCalled();
    expect(complete.mock.calls[0][1].receipt).toBeUndefined();
  });

  it('не-картинки отбрасываются', async () => {
    const { controller, merge } = make(accepted);
    await controller.complete(
      'req1',
      [{ buffer: Buffer.from('pdf'), mimetype: 'application/pdf' } as never],
      {},
    );
    expect(merge).not.toHaveBeenCalled();
  });

  it('курс без площадки не пишется: половина полей хуже, чем пусто', async () => {
    const { controller, complete } = make(accepted);
    await controller.complete('req1', [], { closeRate: '46.2' });
    expect(complete.mock.calls[0][1].close).toBeUndefined();
  });

  it('площадка с курсом пишется, комиссия подтягивается из справочника', async () => {
    const { controller, complete, closeFeeFor } = make(accepted);
    await controller.complete('req1', [], {
      closeAccount: 'binance',
      closeRate: '46.2',
    });
    expect(closeFeeFor).toHaveBeenCalledWith('binance');
    expect(complete.mock.calls[0][1].close).toEqual({
      account: 'binance',
      rate: '46.2',
      fee: '0.15',
      orderId: null,
    });
  });
});
