import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { TelegrafExecutionContext } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { UserService } from '../user/user.service';

/**
 * Админ-гард для хендлеров бота: `@UseGuards(AdminGuard)` на классе или методе.
 * Не админу Nest бросит ForbiddenException — бот ничего не ответит, попытка
 * останется в логах (bot.catch).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly userService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = TelegrafExecutionContext.create(context).getContext<Context>();
    return this.userService.isAdminChat(ctx);
  }
}
