import { CreateRatesScene } from './rates.scene';
import { CustomSceneContext } from 'src/types/types';

type Reply = string;

const ratesService = {
  getAllRatesMarkupMessage: async () => 'RATES',
  createRates: async () => true,
  sendAllRatesToAllVendors: async () => undefined,
} as never;

const makeCtx = (userId: number, replies: Reply[]) =>
  ({
    from: { id: userId, username: `u${userId}` },
    session: { messagesToDelete: [], customState: '' },
    reply: async (text: string) => {
      replies.push(text);
      return { message_id: 1 };
    },
    deleteMessage: async () => true,
    wizard: { next: () => undefined, selectStep: () => undefined },
    scene: { leave: async () => undefined, enter: async () => undefined },
  }) as unknown as CustomSceneContext;

describe('CreateRatesScene lock', () => {
  let scene: CreateRatesScene;

  beforeEach(async () => {
    scene = new CreateRatesScene(ratesService);
    // Лок статический — сбрасываем его чистым выходом владельца.
    await scene.onSceneLeave(makeCtx(1, []));
    await scene.onSceneLeave(makeCtx(2, []));
  });

  it('второй админ получает отказ, пока первый держит лок', async () => {
    const first: Reply[] = [];
    const second: Reply[] = [];
    await scene.onSceneEnter(makeCtx(1, first));
    await scene.onSceneEnter(makeCtx(2, second));

    expect(second[0]).toContain('уже обновляет @u1');
  });

  it('выход заблокированного не снимает чужой лок', async () => {
    const blocked: Reply[] = [];
    const third: Reply[] = [];
    await scene.onSceneEnter(makeCtx(1, []));
    await scene.onSceneEnter(makeCtx(2, blocked)); // войти не смог -> leave
    await scene.onSceneLeave(makeCtx(2, []));
    await scene.onSceneEnter(makeCtx(3, third));

    expect(third[0]).toContain('уже обновляет @u1');
  });

  it('владелец снимает свой лок и следующий заходит', async () => {
    const next: Reply[] = [];
    await scene.onSceneEnter(makeCtx(1, []));
    await scene.onSceneLeave(makeCtx(1, []));
    await scene.onSceneEnter(makeCtx(2, next));

    expect(next.join()).not.toContain('уже обновляет');
  });
});
