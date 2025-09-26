import { Action, Ctx, On, Update } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { UserService } from 'src/modules/user/user.service';
import { RequestService } from 'src/modules/request/request.service';
import { TelegramService } from '../telegram.service';
import { CustomSceneContext, FullRequestType, ReplyPhotoMessage } from 'src/types/types';
import { SceneContext } from 'telegraf/typings/scenes';
import { MenuFactory } from '../telegram-keyboards';
import { RequestMessageFactory } from '../request/request-message.factory';
import { BUTTON_CALLBACKS, BUTTON_TEXTS } from '../telegram.constants';
import { User } from '@prisma/client';
import { AccessControlService } from '../access-control/access-control.service';
import { VendorCallbackService } from '../callback/vendors';

@Update()
export class UserActions {
  constructor(
    private readonly userService: UserService,
    private readonly requestService: RequestService,
    private readonly telegramService: TelegramService,
    private readonly accessControlService: AccessControlService,
    private readonly VendorCallbackService: VendorCallbackService,
  ) {}

  private async getPhotoUrlFromDatabase(requestId: string): Promise<string> {
    try {
      const messages = await this.requestService.getAllPublicMessagesWithRequestsId(requestId);
      if (messages && messages.length > 0) {
        const messageWithPhoto = messages.find(msg => msg.photoUrl && msg.photoUrl !== '');
        if (messageWithPhoto && messageWithPhoto.photoUrl) {
          // Check if it's a Telegram CDN URL (old format) and fall back to default
          if (messageWithPhoto.photoUrl.startsWith('https://api.telegram.org/file/bot')) {
            console.warn('Found old Telegram CDN URL in database, using default image');
            return './src/assets/0056.jpg';
          }
          return messageWithPhoto.photoUrl;
        }
      }
    } catch (error) {
      console.warn('Failed to retrieve photo from database, using default:', error);
    }
    return './src/assets/0056.jpg'; // default fallback
  }

  private async deletePhotoFileIfExists(photoUrl: string): Promise<void> {
    try {
      // Only delete local files, not default images or HTTP URLs
      if (photoUrl && 
          photoUrl !== './src/assets/0056.jpg' && 
          !photoUrl.startsWith('http') &&
          photoUrl.startsWith('./storage/request-photos/')) {
        
        const fs = require('fs').promises;
        try {
          await fs.unlink(photoUrl);
          console.log(`[UserActions] Successfully deleted photo file: ${photoUrl}`);
        } catch (fileError: any) {
          if (fileError.code === 'ENOENT') {
            console.log(`[UserActions] Photo file already deleted or doesn't exist: ${photoUrl}`);
          } else {
            console.error(`[UserActions] Error deleting photo file: ${photoUrl}`, fileError);
          }
        }
      } else {
        console.log(`[UserActions] Skipping deletion of non-local photo: ${photoUrl}`);
      }
    } catch (error) {
      console.error('[UserActions] Error in deletePhotoFileIfExists:', error);
    }
  }

  @Action('new_user')
  async onNewUser(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    await this.userService.createUser(ctx);
    await ctx.reply('You pressed the "New user" button!');
  }

  @On('callback_query')
  async onCallbackQuery(@Ctx() ctx: SceneContext) {
    await ctx.answerCbQuery();
    const callbackQuery = ctx.callbackQuery;
    await this.VendorCallbackService.handleVendorAction(
      ctx as CustomSceneContext,
    );
    if (!callbackQuery) {
      console.error('No callback query found');
      return;
    } else if ('data' in callbackQuery) {
      const currentUserId = callbackQuery.from.id;
      if (callbackQuery.data.startsWith('admin_cancel_request_')) {
        const requestId = callbackQuery.data.substring(
          'admin_cancel_request_'.length,
        );

        if (!requestId) {
          console.warn('admin_cancel_request callback without requestId');
          await ctx.answerCbQuery('Не удалось определить заявку.');
          return;
        }
        const adminCheck =
          await this.accessControlService.canCancelRequestAsAdmin(
            requestId,
            currentUserId,
          );
        if (!adminCheck.allowed) {
          await ctx.answerCbQuery(adminCheck.message);
          return;
        }

        const request = await this.requestService.findById(requestId);
        if (!request) {
          throw new Error('Request not found');
        }
        await this.requestService.updateRequestStatus(
          requestId,
          'FAILED',
          callbackQuery.from.id,
        );
        const photoUrl = await this.getPhotoUrlFromDatabase(requestId);
        const workerMenu = MenuFactory.createWorkerMenu(
          request as unknown as FullRequestType,
          photoUrl,
        );

        const adminMenu = MenuFactory.createAdminMenu(
          request as unknown as FullRequestType,
          photoUrl,
        );
        await this.telegramService.updateAllWorkersMessagesWithRequestsId(
          {
            text: workerMenu.canceled().caption + '\n' + 'Заявка отменена',
            inline_keyboard: adminMenu.canceled(undefined, requestId).markup,
          },
          requestId,
        );
        await this.telegramService.updateAllAdminsMessagesWithRequestsId(
          {
            text: adminMenu.canceled().caption + '\n' + 'Заявка отменена',
            inline_keyboard: adminMenu.canceled(undefined, requestId).markup,
          },
          requestId,
        );
        const publicPayload = this.buildPublicCancelPayload(
          request as unknown as FullRequestType,
        );
        console.log(publicPayload,'publicPayload')
        await this.telegramService.updateAllPublicMessagesWithRequestsId(
          publicPayload,
          requestId,
        );
        
        // Delete saved photo file if it exists
        await this.deletePhotoFileIfExists(photoUrl);
      }
      if (callbackQuery.data.startsWith('cancel_payment_')) {
        const requestId = callbackQuery.data.substring('cancel_payment_'.length);

        if (!requestId) {
          console.warn('cancel_payment callback without requestId');
          await ctx.answerCbQuery('Не удалось определить заявку.');
          return;
        }

        // Проверка прав на управление заявкой
        const accessCheck = await this.accessControlService.canManageRequest(
          requestId,
          currentUserId,
        );
        if (!accessCheck.allowed) {
          await ctx.answerCbQuery(accessCheck.message);
          return;
        }

        const request = await this.requestService.findById(requestId);
        if (!request) {
          throw new Error('Request not found');
        }
        const photoUrl = await this.getPhotoUrlFromDatabase(requestId);
        const workerMenu = MenuFactory.createWorkerMenu(
          request as unknown as FullRequestType,
          photoUrl,
        );
        await ctx.editMessageCaption(
          workerMenu.canceled().caption + '\n' + 'Заявка отменена',
          {
            reply_markup: workerMenu.canceled(undefined, requestId).markup,
            parse_mode: 'HTML',
          },
        );
        
      }
      if (callbackQuery.data.startsWith('accept_request_')) {
        const requestId = callbackQuery.data.substring('accept_request_'.length);

        if (!requestId) {
          console.warn('accept_request callback without requestId');
          await ctx.answerCbQuery('Не удалось определить заявку.');
          return;
        }
        const acceptCheck = await this.accessControlService.canAcceptRequest(
          requestId,
          currentUserId,
        );
        if (!acceptCheck.allowed) {
          await ctx.answerCbQuery(acceptCheck.message);
          return;
        }
        try {
          await ctx.scene.enter('accept-request', { requestId });
          return;
        } catch (error) {
          console.error('Error accepting request:', error);
          return;
        }
      }
      if (callbackQuery.data.startsWith('cancel_worker_request_')) {
        const requestId = callbackQuery.data.substring(
          'cancel_worker_request_'.length,
        );

        if (!requestId) {
          console.warn('cancel_worker_request callback without requestId');
          await ctx.answerCbQuery('Не удалось определить заявку.');
          return;
        }

        const accessCheck = await this.accessControlService.canManageRequest(
          requestId,
          currentUserId,
        );
        if (!accessCheck.allowed) {
          await ctx.answerCbQuery(accessCheck.message);
          return;
        }

        const request = await this.requestService.findById(requestId);
        if (!request) {
          throw new Error('Request not found');
        }
        const photoUrl = await this.getPhotoUrlFromDatabase(requestId);

        const workerMenu = MenuFactory.createWorkerMenu(
          request as unknown as FullRequestType,
          photoUrl,
        );

        await this.telegramService.updateAllWorkersMessagesWithRequestsId(
          {
            text: workerMenu.canceled().caption,
            inline_keyboard: workerMenu.canceled(undefined, requestId).markup,
          },
          requestId,
        );
        
        // Delete saved photo file if it exists
        await this.deletePhotoFileIfExists(photoUrl);
      } else if (callbackQuery.data.startsWith('give_next_')) {
        const requestId = callbackQuery.data.substring('give_next_'.length);

        if (!requestId) {
          console.warn('give_next callback without requestId');
          await ctx.answerCbQuery('Не удалось определить заявку.');
          return;
        }

        // Проверка прав на управление заявкой
        const accessCheck = await this.accessControlService.canManageRequest(
          requestId,
          currentUserId,
        );
        if (!accessCheck.allowed) {
          await ctx.answerCbQuery(accessCheck.message);
          return;
        }

        const request = await this.requestService.findById(requestId);
        if (!request) {
          throw new Error('Request not found');
        }
        const users = await this.userService.findAllWorkers();
        const workerMenu = MenuFactory.createWorkerMenu(
          request as unknown as FullRequestType,
          '',
        );
        let newWorker: User | undefined;
        for (const user of users) {
          if (request?.user?.id !== user.id) {
            await this.requestService.acceptRequest(
              requestId,
              Number(user.telegramId),
              Number(user.telegramId),
            );
            newWorker = user;
            // console.log('New worker found:', newWorker);
            break;
          } else {
            newWorker = undefined;
          }
        }
        if (!newWorker) {
          await ctx.answerCbQuery('No available workers found');
          await ctx.editMessageCaption(
            workerMenu.inWork().caption + '\n' + 'Нут доступных пользователей',
            {
              parse_mode: 'HTML',
              reply_markup: workerMenu.inWork(undefined, requestId).markup,
            },
          );
          return;
        }

        await this.requestService.findAndDeleteRequestMessageByRequestId(
          requestId,
          callbackQuery.message!.message_id,
        );
        await ctx.deleteMessage(callbackQuery.message?.message_id);
        await this.telegramService.sendMessageToUser(
          {
            text: workerMenu.inWork().caption,
            photoUrl: workerMenu.inWork().url,
            inline_keyboard: workerMenu.inWork(undefined, requestId).markup,
          },
          Number(newWorker?.telegramId),
          requestId,
          newWorker?.id,
        );
        const adminMenu = MenuFactory.createAdminMenu(
          request as unknown as FullRequestType,
          '',
        );
        await this.telegramService.updateAllAdminsMessagesWithRequestsId(
          {
            text: adminMenu.inWork().caption,
            inline_keyboard: adminMenu.inWork(undefined, requestId).markup,
          },
          requestId,
        );
      } else if (callbackQuery.data.includes('valut_card_')) {
        const requestId = callbackQuery.data.split('_')[2];

        // Проверка прав на управление заявкой
        const accessCheck = await this.accessControlService.canManageRequest(
          requestId,
          currentUserId,
        );
        if (!accessCheck.allowed) {
          await ctx.answerCbQuery(accessCheck.message);
          return;
        }

        const request = await this.requestService.findById(requestId);
        if (!request) {
          throw new Error('Request not found');
        }
        const photoUrl = await this.getPhotoUrlFromDatabase(requestId);
        const workerMenu = MenuFactory.createWorkerMenu(
          request as unknown as FullRequestType,
          photoUrl,
        );
        const adminMenu = MenuFactory.createAdminMenu(
          request as unknown as FullRequestType,
          photoUrl,
        );
        const markup = Markup.inlineKeyboard([
          Markup.button.callback('Валютная карта', 'афлют'),
        ]);
        await ctx.editMessageCaption(
          workerMenu.inWork().caption + '\n' + 'Заявка отменина',
          {
            reply_markup: markup.reply_markup,
            parse_mode: 'HTML',
          },
        );
        await this.telegramService.updateAllAdminsMessagesWithRequestsId(
          {
            text: adminMenu.inWork().caption + '\n' + 'Заявка отменина',
            inline_keyboard: markup.reply_markup,
          },
          request.id,
        );
        const userId = ctx.from?.id;
        if (!userId) {
          return;
        }
        await this.requestService.updateRequestStatus(
          request.id,
          'FAILED',
          Number(userId),
        );
        await this.deletePhotoFileIfExists(photoUrl);
      } else if (callbackQuery.data.includes('back_to_take_request_')) {
        const requestId = callbackQuery.data.split('_')[4];
        const accessCheck = await this.accessControlService.canManageRequest(
          requestId,
          currentUserId,
        );
        if (!accessCheck.allowed) {
          await ctx.answerCbQuery(accessCheck.message);
          return;
        }

        const request = await this.requestService.findById(requestId);
        if (!request) {
          throw new Error('Request not found');
        }
        try {
          await this.requestService.unlinkUser(request.id);
          await this.telegramService.updateAdminMessages(request.id);
          await this.telegramService.updateWorkerMessages(
            request.id,
            false,
            true,
          );
          await this.requestService.findAndDeleteRequestMessageByRequestId(
            requestId,
            callbackQuery.message!.message_id,
          );
          await ctx.deleteMessage(callbackQuery.message?.message_id);
          await ctx.answerCbQuery('Заявка возвращена в очередь');
        } catch (error) {
          console.error(error);
          await ctx.answerCbQuery('Ошибка при отмене заявки');
          return;
        }
      }

      if (callbackQuery.data.includes('proceeded_payment_')) {
        const requestId = callbackQuery.data.split('_')[2];

        const messageId = callbackQuery.message?.message_id;
        const accessCheck = await this.accessControlService.canManageRequest(
          requestId,
          currentUserId,
        );
        if (!accessCheck.allowed) {
          await ctx.answerCbQuery(accessCheck.message);
          return;
        }

        const request = await this.requestService.findById(requestId);
        if (!request) {
          throw new Error('Request not found');
        }
        const photoUrl = await this.getPhotoUrlFromDatabase(requestId);
        const workerMenu = MenuFactory.createWorkerMenu(
          request as unknown as FullRequestType,
          photoUrl,
        );
        const button = Markup.button.callback(
          'Отменить',
          'accept_request_' + requestId,
        );
        const inline_keyboard = Markup.inlineKeyboard([[button]]);
        // await this.telegramService.updateAllWorkersMessagesWithRequestsId(
        //   {
        //     text: workerMenu.inWork().caption,
        //     inline_keyboard: inline_keyboard.reply_markup,
        //   },
        //   requestId,
        // );
        await ctx.editMessageMedia(
          {
            media: {
              source: photoUrl,
            },
            type: 'photo',
            caption: workerMenu.inWork().caption,
            parse_mode: 'HTML',
          },
          {
            reply_markup: undefined,
          },
        );
        await ctx.scene.enter('payment_photo_proceed', {
          requestId,
          messageId,
        });
      }
    } else {
      console.error('Unknown callback query data:', callbackQuery);
      await ctx.answerCbQuery('Unknown action');
    }
  }

  private buildPublicCancelPayload(request: FullRequestType): ReplyPhotoMessage {
    const methodPayload =
      request.methods
        ?.map((method) =>
          RequestMessageFactory.create('PUBLIC', request, method, {
            maskSensitive: false,
          }),
        )
        .find((payload) => payload !== null) ?? null;

    const baseText = methodPayload?.text
      ? `${methodPayload.text}\n\n❌ Заявка отменена`
      : `✉️<b>Заявка номер:</b> <code>${request.id}</code>\n❌ Заявка отменена`;

    return {
      text: baseText,
      inline_keyboard: Markup.inlineKeyboard([
          [Markup.button.callback(BUTTON_TEXTS.IN_WORK, BUTTON_CALLBACKS.DUMMY)],
        ]).reply_markup,
      photoUrl: methodPayload?.photoUrl,
      source: methodPayload?.source,
    };
  }
}
