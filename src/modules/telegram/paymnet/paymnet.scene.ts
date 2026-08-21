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

interface PaymentWizardState {
  requestId: string;
  messageId?: number;
  paymentPhoto?: PaymentPhoto;
  paymentPhotos: PaymentPhoto[];
  mediaGroupId?: string;
}

// Таймер дебаунса media_group живёт вне scene state: telegraf-session-local
// сериализует state целиком, а Timeout циклический — JSON.stringify падал и
// ронял запись sessions.json сразу для всех чатов.
const collectTimers = new Map<string, ReturnType<typeof setTimeout>>();

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

  private async getPhotoUrlFromDatabase(requestId: string): Promise<string> {
    try {
      const messages = await this.requestService.getAllPublicMessagesWithRequestsId(requestId);
      if (messages && messages.length > 0) {
        const messageWithPhoto = messages.find(msg => msg.photoUrl && msg.photoUrl !== '');
        if (messageWithPhoto && messageWithPhoto.photoUrl) {
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
    return './src/assets/0056.jpg';
  }

  private async deletePhotoFileIfExists(photoUrl: string): Promise<void> {
    try {
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
    const state = ctx.wizard.state as PaymentWizardState;
    if (!state.paymentPhotos) state.paymentPhotos = [];
    const message = ctx.message as { photo?: PaymentPhoto[]; media_group_id?: string };

    // Handle photo message
    if (message && Array.isArray(message.photo)) {
      ctx.session.messagesToDelete?.push(ctx.message?.message_id || 0);

      const photo = message.photo[message.photo.length - 1];
      state.paymentPhotos.push(photo);
      // Keep backward compat
      state.paymentPhoto = photo;

      // If part of media group, debounce confirm prompt
      if (message.media_group_id) {
        state.mediaGroupId = message.media_group_id;
        // Clear previous timer if exists
        const timerKey = `${ctx.chat?.id}:${ctx.from?.id}`;
        const pending = collectTimers.get(timerKey);
        if (pending) clearTimeout(pending);
        collectTimers.set(
          timerKey,
          setTimeout(async () => {
            collectTimers.delete(timerKey);
            await this.showConfirmPrompt(ctx, state);
          }, 1500),
        );
        return;
      }

      // Single photo — show confirm immediately
      await this.showConfirmPrompt(ctx, state);
      return;
    }

    // Handle callbacks
    if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
      const data = ctx.callbackQuery.data;

      if (data === 'confirm_receipt') {
        const photos = state.paymentPhotos?.length ? state.paymentPhotos : (state.paymentPhoto ? [state.paymentPhoto] : []);
        if (photos.length === 0) {
          await ctx.answerCbQuery('Фото не найдено');
          return;
        }

        const requestId = state.requestId;
        const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN')!;
        const buffers = await Promise.all(
          photos.map((p) => this.utilsService.downloadTelegramPhoto(token, p.file_id)),
        );
        const buffer = buffers.length > 1
          ? await this.utilsService.mergeImagesGrid(buffers)
          : buffers[0];

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
        await this.telegramService.deleteReminderMessagesForRequest(requestId);

        const publicMenu = MenuFactory.createPublicMenu(
          request as unknown as FullRequestType,
          '',
          buffer,
        );
        const workerMenu = MenuFactory.createWorkerMenu(
          request as unknown as FullRequestType,
          '',
          buffer,
        );
        const adminMenu = MenuFactory.createAdminMenu(
          request as unknown as FullRequestType,
          '',
          buffer,
        );
        await this.telegramService.updateAllWorkersMessagesWithRequestsId(
          {
            source: workerMenu.done(undefined, requestId).source,
            text: workerMenu.done(undefined, requestId).caption,
            inline_keyboard: workerMenu.done(undefined, requestId).markup,
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

        const photoUrl = await this.getPhotoUrlFromDatabase(requestId);
        await this.deletePhotoFileIfExists(photoUrl);

        await ctx.scene.leave();
        return;
      }

      if (data === 'retry_receipt') {
        state.paymentPhoto = undefined;
        state.paymentPhotos = [];
        state.mediaGroupId = undefined;
        await ctx.answerCbQuery('Отправьте новую квитанцию');
        const msg = await ctx.reply('Пожалуйста прикрепите квитанцию', {
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('Отмена', 'cancel_payment_photo_proceed')],
          ]).reply_markup,
        });
        ctx.session.requestMenuMessageId?.push(msg.message_id);
        return;
      }

      if (data === 'cancel_payment_photo_proceed') {
        const requestId = state.requestId;
        const messageId = state.messageId;
        const request = await this.requestService.findById(requestId);
        if (!request) {
          await ctx.scene.leave();
          throw new Error('Request not found');
        }
        const photoUrl = await this.getPhotoUrlFromDatabase(requestId);

        const workerMenu = MenuFactory.createWorkerMenu(
          request as unknown as FullRequestType,
          photoUrl,
          undefined,
          true,
          false,
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
            caption: workerMenu.inProcess(undefined, request.id).caption,
            parse_mode: 'HTML',
          },
          {
            reply_markup: workerMenu.inProcess(undefined, request.id).markup,
          },
        );
        await ctx.scene.leave();
        return;
      }

      if (data.includes('accept_request')) {
        console.error('Unknown callback query data:', ctx.callbackQuery);
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
        return;
      }

      console.error('Unknown callback query data:', ctx.callbackQuery);
      await ctx.answerCbQuery('Unknown action');
      return;
    }

    await ctx.scene.leave();
  }

  private async showConfirmPrompt(ctx: CustomSceneContext, state: PaymentWizardState) {
    const count = state.paymentPhotos?.length || 1;
    const caption = count > 1
      ? `Получено ${count} фото. Подтвердите квитанцию (будут объединены в одно изображение)`
      : 'Подтвердите квитанцию';

    const lastPhoto = state.paymentPhotos?.[state.paymentPhotos.length - 1] || state.paymentPhoto;
    if (!lastPhoto) return;

    const confirmMsg = await ctx.replyWithPhoto(lastPhoto.file_id, {
      caption,
      reply_markup: Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Подтвердить', 'confirm_receipt'),
          Markup.button.callback('🔄 Переснять', 'retry_receipt'),
        ],
        [Markup.button.callback('❌ Отмена', 'cancel_payment_photo_proceed')],
      ]).reply_markup,
    });
    ctx.session.requestMenuMessageId?.push(confirmMsg.message_id);
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
