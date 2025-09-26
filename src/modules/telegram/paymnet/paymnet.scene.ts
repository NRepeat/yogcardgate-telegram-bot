import { Injectable } from '@nestjs/common';
import {
  Ctx,
  InjectBot,
  On,
  SceneLeave,
  Wizard,
  WizardStep,
} from 'nestjs-telegraf';
import { CustomSceneContext, FullRequestType } from 'src/types/types';
import { Context, Markup, Telegraf } from 'telegraf';
import { TelegramService } from '../telegram.service';
import { UtilsService } from 'src/modules/utils/utils.service';
import { ConfigService } from '@nestjs/config';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import { RequestService } from 'src/modules/request/request.service';
import { MenuFactory } from '../telegram-keyboards';

export type PaymentPhoto = {
  file_id: string;
  file_unique_id: string;
  file_size: number;
  width: number;
  height: number;
};

@Injectable()
@Wizard('payment_photo_proceed')
export default class PaymentWizard {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly utilsService: UtilsService,
    @InjectBot() private bot: Telegraf<Context>,
    private readonly configService: ConfigService,
    private readonly requestService: RequestService,
  ) {}
  paymentPhotos: PaymentPhoto[] = [];

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
          console.log(`[PaymentWizard] Successfully deleted photo file: ${photoUrl}`);
        } catch (fileError: any) {
          if (fileError.code === 'ENOENT') {
            console.log(`[PaymentWizard] Photo file already deleted or doesn't exist: ${photoUrl}`);
          } else {
            console.error(`[PaymentWizard] Error deleting photo file: ${photoUrl}`, fileError);
          }
        }
      } else {
        console.log(`[PaymentWizard] Skipping deletion of non-local photo: ${photoUrl}`);
      }
    } catch (error) {
      console.error('[PaymentWizard] Error in deletePhotoFileIfExists:', error);
    }
  }

  @WizardStep(0)
  async proceedFirstStep(@Ctx() ctx: CustomSceneContext) {
    const inline_keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('Отмена', 'cancel_payment_photo_proceed')],
    ]);
    const msg = await ctx.reply('Пожалуйста прикрепите квитанцию', {
      reply_markup: inline_keyboard.reply_markup,
    });
    ctx.session.messagesToDelete = ctx.session.messagesToDelete || [];
    ctx.session.requestMenuMessageId = ctx.session.requestMenuMessageId || [];
    ctx.session.requestMenuMessageId.push(msg.message_id);
    ctx.wizard.next();
  }

  @WizardStep(1)
  async proceedFinalStep(@Ctx() ctx: CustomSceneContext) {
    const message = ctx.message as { photo?: PaymentPhoto[] };
    ctx.session.messagesToDelete?.push(ctx.message?.message_id || 0);
    if (message && Array.isArray(message.photo)) {
      this.paymentPhotos.push(message.photo[message.photo.length - 1]);
      if (Array.isArray(this.paymentPhotos)) {
        const state = ctx.wizard.state as { requestId: string };
        const requestId = state.requestId;
        const buffers = await Promise.all(
          this.paymentPhotos.map((photo) => {
            return this.utilsService.downloadTelegramPhoto(
              this.configService.get<string>('TELEGRAM_BOT_TOKEN')!,
              photo.file_id,
            );
          }),
        );
        const mergedImageBuffer =
          await this.utilsService.mergeImagesHorizontal(buffers);
        const userId = ctx.from?.id;
        if (!userId) {
          throw new Error('User ID not found in context');
        }
        const request = await this.requestService.findById(requestId);
        if (!request) {
          await ctx.scene.leave();
          throw new Error('Request not found');
        }
        await this.requestService.updateRequestStatus(
          requestId,
          'COMPLETED',
          userId,
        );

        const publicMenu = MenuFactory.createPublicMenu(
          request as unknown as FullRequestType,
          '',
          mergedImageBuffer,
        );
        const workerMenu = MenuFactory.createWorkerMenu(
          request as unknown as FullRequestType,
          '',
          mergedImageBuffer,
        );
        const adminMenu = MenuFactory.createAdminMenu(
          request as unknown as FullRequestType,
          '',
          mergedImageBuffer,
        );
        await this.telegramService.updateAllWorkersMessagesWithRequestsId(
          {
            source: workerMenu.done().source,
            text: workerMenu.done().caption,
            inline_keyboard: workerMenu.done().markup,
          },
          requestId,
        );
        await this.telegramService.updateAllAdminsMessagesWithRequestsId(
          {
            source: adminMenu.done().source,
            text: adminMenu.done().caption,
            inline_keyboard: adminMenu.done().markup,
          },
          requestId,
        );

        await this.telegramService.updateAllPublicMessagesWithRequestsId(
          {
            text: publicMenu.done().caption,
            inline_keyboard: publicMenu.done().markup,
            source: publicMenu.done().source,
          },
          requestId,
        );

        // Delete saved photo file if it exists after completing the request
        const photoUrl = await this.getPhotoUrlFromDatabase(requestId);
        await this.deletePhotoFileIfExists(photoUrl);
      } else {
        return;
      }

      await ctx.scene.leave();

      this.paymentPhotos = [];
    } else {
      console.error('No photos found in the message');
      if (ctx.callbackQuery) {
        if (
          'data' in ctx.callbackQuery &&
          ctx.callbackQuery.data === 'cancel_payment_photo_proceed'
        ) {
          const state = ctx.wizard.state as {
            requestId: string;
            messageId?: number;
          };
          const requestId = state.requestId;
          const messageId = state.messageId;
          const request = await this.requestService.findById(requestId);
          console.log(
            'Canceling payment photo proceed for request:',
            requestId,
            ctx.message,
          );
          if (!request) {
            await ctx.scene.leave();
            throw new Error('Request not found');
          }
          const photoUrl = await this.getPhotoUrlFromDatabase(requestId);

          const workerMenu = MenuFactory.createWorkerMenu(
            request as unknown as FullRequestType,
            photoUrl,
          );
          await this.bot.telegram.editMessageMedia(
            ctx.chat?.id!,
            messageId!,
            undefined,
            {
              media: {
                source: photoUrl,
              },
              type: 'photo',
              caption: workerMenu.inWork().caption,
              parse_mode: 'HTML',
            },
            {
              reply_markup: workerMenu.inProcess(undefined, request.id).markup,
            },
          );
          await ctx.scene.leave();
        } else if (
          'data' in ctx.callbackQuery &&
          ctx.callbackQuery.data.includes('accept_request')
        ) {
          console.error('Unknown callback query data:', ctx.callbackQuery);
          const state = ctx.wizard.state as { requestId: string };
          const requestId = state.requestId;
          const request = await this.requestService.findById(requestId);
          if (!request) {
            await ctx.scene.leave();
            throw new Error('Request not found');
          }
          const photoUrl = await this.getPhotoUrlFromDatabase(requestId);

          const workerMenu = MenuFactory.createWorkerMenu(
            request as unknown as FullRequestType,
            photoUrl,
          );
          await this.telegramService.updateAllWorkersMessagesWithRequestsId(
            {
              text: workerMenu.inWork().caption,
              inline_keyboard: workerMenu.inProcess(undefined, request.id)
                .markup,
            },
            requestId,
          );
          await ctx.scene.leave();
        } else {
          console.error('Unknown callback query data:', ctx.callbackQuery);
          await ctx.answerCbQuery('Unknown action');
          // await ctx.scene.leave();
          return;
        }
      }
      await ctx.scene.leave();
    }
  }
  
  @SceneLeave()
  async onSceneLeave(@Ctx() ctx: CustomSceneContext) {
    await this.deleteSceneMessages(ctx);
    await this.deleteSceneMenuMessages(ctx);
    ctx.session.messagesToDelete = [];
    ctx.session.customState = '';
    ctx.session.requestMenuMessageId = undefined;
  }
  async deleteSceneMessages(ctx: CustomSceneContext, msgIdToPass?: number[]) {
    try {
      await this.telegramService.deleteAllTelegramMessages(
        ctx.session.messagesToDelete,
        ctx.chat?.id,
        msgIdToPass,
      );
      ctx.session.messagesToDelete = [];
    } catch (error) {
      console.error('Failed to delete scene messages:', error);
    }
  }
  async deleteSceneMenuMessages(ctx: CustomSceneContext) {
    try {
      await ctx.deleteMessages(ctx.session.requestMenuMessageId || []);
      ctx.session.requestMenuMessageId = [];
    } catch (error) {
      console.error('Failed to delete scene messages:', error);
    }
  }
  async updateSceneMenuMessage(
    ctx: CustomSceneContext,
    text: string,
    markup?: InlineKeyboardMarkup,
  ) {
    try {
      await ctx.editMessageText(text, {
        reply_markup: markup ?? undefined,
      });
    } catch (error) {
      console.error('Failed to update scene menu message:', error);
    }
  }
}
