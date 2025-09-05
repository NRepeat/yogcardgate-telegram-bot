import { Injectable } from '@nestjs/common';
import { SceneLeave, Wizard, WizardStep } from 'nestjs-telegraf';
import { RequestService } from 'src/modules/request/request.service';
import { CustomSceneContext, FullRequestType } from 'src/types/types';
import { MenuFactory } from '../telegram-keyboards';
import { Markup } from 'telegraf';
import { TelegramService } from '../telegram.service';
import { AccessControlService } from '../access-control/access-control.service';
import { UserService } from 'src/modules/user/user.service';
const photoUrl = './src/assets/0056.jpg';

@Injectable()
@Wizard('accept-request')
export class AcceptRequestScene {
  constructor(
    private readonly requestService: RequestService,
    private readonly telegramService: TelegramService,
    private readonly accessControlService: AccessControlService,
    private readonly userService: UserService,
  ) {}

  @WizardStep(0)
  async enter(ctx: CustomSceneContext) {
    const state = ctx.wizard.state as { requestId: string; msId?: number };
    if (!ctx.from) {
      await ctx.reply('Please fill out the form before accepting the request.');
      return;
    }
    const userId = ctx.from.id;
    const chatId = ctx.message?.chat.id;
    try {
      const accessCheck = await this.accessControlService.canAcceptRequest(
        state.requestId,
        userId,
      );
      if (!accessCheck.allowed) {
        await ctx.reply(
          accessCheck.message || '❌ Нет прав для принятия заявки',
        );
        await ctx.scene.leave();
        return;
      }
      await this.requestService.acceptRequest(state.requestId, userId, userId);
      const request = (await this.requestService.findById(
        state.requestId,
      )) as FullRequestType;
      const workerMenu = MenuFactory.createWorkerMenu(
        request,
        photoUrl,
        undefined,
        true,
      );
      const user = await this.userService.findByTelegramId(userId);
      if (!user) {
        await ctx.scene.leave();
        return;
      }
      const workGroupChatId = user.workGroupChatId;
      if (!workGroupChatId) {
        await ctx.scene.leave();
        return;
      }

      const message = await this.telegramService.sendMessageToUser(
        {
          text: workerMenu.inProcess(undefined, state.requestId).caption,
          inline_keyboard: workerMenu.inProcess(undefined, state.requestId)
            .markup,
          photoUrl: photoUrl,
        },
        Number(workGroupChatId),
        state.requestId,
        String(userId),
      );
      if (!message) {
        throw new Error('Failed to send message to user');
      }
      (ctx.wizard.state as { requestId: string; msId?: number }).msId =
        message.message_id;

      await this.notifyUsers(ctx);
      await ctx.scene.leave();
      // ctx.wizard.selectStep(1);
    } catch (error) {
      console.error(error);
      await ctx.reply('An error occurred while accepting the request.');
      await ctx.scene.leave();
    }
  }
  @WizardStep(1)
  async notifyUsers(ctx: CustomSceneContext) {
    const state = ctx.wizard.state as { requestId: string; msId: number };
    console.log('Notify users with state:', state);
    const requestId = state.requestId;
    let request;
    try {
      request = await this.requestService.findById(requestId);
    } catch (error) {
      console.error(error);
      await ctx.reply('An error occurred while notifying users.');
    }
    const workerMenu = MenuFactory.createWorkerMenu(
      request as unknown as FullRequestType,
      './src/assets/0056.jpg',
    );
    const newPaymentButton = Markup.button.callback('В работе', 'in_work_');
    const newCancelButton = Markup.button.callback(
      'Отмена',
      'cancel_payment_' + requestId,
    );
    const inline_keyboard = Markup.inlineKeyboard([[newPaymentButton]]);
    await this.telegramService.updateAllWorkersMessagesWithRequestsId(
      {
        text: workerMenu.done().caption,
        inline_keyboard: inline_keyboard.reply_markup,
      },
      requestId,
      [state.msId],
    );

    const adminMenu = MenuFactory.createAdminMenu(
      request as unknown as FullRequestType,
      './src/assets/0056.jpg',
    );
    await this.telegramService.updateAllAdminsMessagesWithRequestsId(
      {
        text: adminMenu.inWork().caption,
        inline_keyboard: adminMenu.inWork(undefined, requestId).markup,
      },
      requestId,
    );
    await ctx.scene.leave();
  }
  @SceneLeave()
  async leave(ctx: CustomSceneContext) {
    const state = ctx.wizard.state as { requestId: string };
    try {
      // await this.requestService.cancelRequest(state.requestId);
    } catch (error) {
      console.error(error);
      await ctx.reply('An error occurred while canceling the request.');
    }
  }
}
