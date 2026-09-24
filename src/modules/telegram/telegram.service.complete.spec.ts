import { TelegramService } from './telegram.service';

/**
 * Деньги: строка закрытия («Закрытие: OKX · курс 46.21 · …») собирается из
 * полей заявки, поэтому карточку рисуем по свежей записи. Читали до update —
 * в карточке не было ни курса закрытия, ни площадки, хотя в базе они стояли.
 */
describe('TelegramService.completeRequestAndRefreshCards', () => {
  const make = (request: any = { id: 'r1', amount: 1000, rate: 40 }) => {
    const calls: string[] = [];
    const requestService = {
      completeRequestWithClose: jest.fn(async () => {
        calls.push('complete-with-close');
      }),
      updateRequestStatus: jest.fn(async (_id: string, status: string) => {
        calls.push(`status:${status}`);
      }),
      findById: jest.fn(async () => {
        calls.push('find');
        return request;
      }),
      findReminderMessages: jest.fn(async () => []),
      getAllPublicMessagesWithRequestsId: jest.fn(async () => []),
      setMessagesPhoto: jest.fn(async () => undefined),
      deleteReminderMessages: jest.fn(async () => undefined),
    };
    const service = Object.create(TelegramService.prototype) as TelegramService;
    Object.assign(service, {
      requestService,
      logger: { warn: jest.fn(), error: jest.fn() },
      updateAllWorkersMessagesWithRequestsId: jest.fn(async () => 'file-1'),
      updateAllAdminsMessagesWithRequestsId: jest.fn(async () => 'file-1'),
      updateAllPublicMessagesWithRequestsId: jest.fn(async () => 'file-1'),
      deleteAllTelegramMessages: jest.fn(async () => undefined),
    });
    return { service, requestService, calls };
  };

  it('заявка читается уже после записи закрытия', async () => {
    const { service, requestService, calls } = make();
    await service.completeRequestAndRefreshCards('r1', {
      actorTgId: 777,
      receipt: { fileId: 'p1' },
      close: { account: 'okx', rate: '46.21', fee: '0.1', orderId: null },
    });
    expect(requestService.completeRequestWithClose).toHaveBeenCalled();
    expect(calls.indexOf('complete-with-close')).toBeLessThan(
      calls.indexOf('find'),
    );
  });

  it('без данных закрытия ставится просто COMPLETED', async () => {
    const { service, requestService } = make();
    await service.completeRequestAndRefreshCards('r1', { actorTgId: 777 });
    expect(requestService.completeRequestWithClose).not.toHaveBeenCalled();
    expect(requestService.updateRequestStatus).toHaveBeenCalledWith(
      'r1',
      'COMPLETED',
      777,
    );
  });

  it('квитанция запоминается карточкам одним file_id', async () => {
    const { service, requestService } = make();
    await service.completeRequestAndRefreshCards('r1', {
      actorTgId: 777,
      receipt: { buffer: Buffer.from('img') },
    });
    expect(requestService.setMessagesPhoto).toHaveBeenCalledWith(
      'r1',
      'file-1',
    );
  });

  it('пропавшая заявка — ошибка, а не тихо нарисованная карточка', async () => {
    const { service } = make(null);
    await expect(
      service.completeRequestAndRefreshCards('r1', { actorTgId: 777 }),
    ).rejects.toThrow('Request not found');
  });
});
