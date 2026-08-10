import { ExecutionContext } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { UserService } from '../user/user.service';

const execContext = (from?: { id: number }): ExecutionContext =>
  ({
    getType: () => 'telegraf',
    getArgs: () => [{ from }, () => undefined],
    getClass: () => class {},
    getHandler: () => () => undefined,
  }) as unknown as ExecutionContext;

// Реальный isAdminChat поверх фейкового репозитория: проверяем и распаковку
// telegraf-контекста из ExecutionContext, и сравнение telegramId.
const guardWith = (adminIds: number[]) => {
  const userService = new UserService({
    getAllAdmins: async () => ({
      users: adminIds.map((id) => ({ telegramId: BigInt(id) })),
    }),
  } as never);
  return new AdminGuard(userService);
};

describe('AdminGuard', () => {
  it('пускает админа', async () => {
    await expect(
      guardWith([111, 222]).canActivate(execContext({ id: 222 })),
    ).resolves.toBe(true);
  });

  it('не пускает не-админа', async () => {
    await expect(
      guardWith([111]).canActivate(execContext({ id: 999 })),
    ).resolves.toBe(false);
  });

  it('не пускает апдейт без from', async () => {
    await expect(
      guardWith([111]).canActivate(execContext(undefined)),
    ).resolves.toBe(false);
  });
});
