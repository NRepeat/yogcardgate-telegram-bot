import { Injectable } from '@nestjs/common';
import { promises as fs, createReadStream } from 'fs';
import * as path from 'path';
import { Wizard, WizardStep, Ctx, SceneLeave, On } from 'nestjs-telegraf';
import { RatesService } from 'src/modules/rates/rates.service';
import { RequestService } from 'src/modules/request/request.service';
import { UtilsService } from 'src/modules/utils/utils.service';
import { VendorService } from 'src/modules/vendor/vendor.service';
import {
  CardRequestType,
  CustomSceneContext,
  FullRequestType,
  IbanRequestType,
  PaymentMethodFormDefinition,
  SerializedMessage,
  ReplyPhotoMessage,
} from 'src/types/types';
import { TelegramService } from '../telegram.service';
import {
  InlineKeyboardButton,
  InlineKeyboardMarkup,
  PhotoSize,
} from 'telegraf/typings/core/types/typegram';
import {
  BUTTON_CALLBACKS,
  BUTTON_TEXTS,
  MenuFactory,
} from '../telegram-keyboards';
import { CurrencyService } from 'src/modules/currencie/currencie.service';
import { Markup } from 'telegraf';
import { AccessType, CurrencyEnum, PaymentMethodEnum } from '@prisma/client';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { PaymentFormFactory } from './payment-form.factory';
import {
  PaymentRequestStrategy,
  StrategyExecuteContext,
} from './strategies/payment-request.strategy';
import { UsdCardStrategy } from './strategies/usd-card.strategy';
import { UsdSkrillEmailStrategy } from './strategies/usd-skrill-email.strategy';
import { UsdWiseStrategy } from './strategies/usd-wise.strategy';
import { UsdPayPalStrategy } from './strategies/usd-paypal.strategy';
import { UahCardStrategy } from './strategies/uah-card.strategy';
import { UahIbanStrategy } from './strategies/uah-iban.strategy';
import { UahIbanCompanyStrategy } from './strategies/uah-iban-company.strategy';
import { GenericFormStrategy } from './strategies/generic-form.strategy';
import { AznOtherBanksStrategy } from './strategies/azn-other-banks.strategy';
import { EurIbanBusinessStrategy } from './strategies/eur-iban-business.strategy';
import { UahStrategyDependencies } from './strategies/uah-base.strategy';
import { EurStrategyDependencies } from './strategies/eur-base.strategy';
import { EurCardStrategy } from './strategies/eur-card.strategy';
import { EurIbanStrategy } from './strategies/eur-iban.strategy';
import { EurSkrillEmailStrategy } from './strategies/eur-skrill-email.strategy';
import { AedStrategyDependencies } from './strategies/aed-base.strategy';
import { AedIbanStrategy } from './strategies/aed-iban.strategy';
import { PlnStrategyDependencies } from './strategies/pln-base.strategy';
import { PlnIbanStrategy } from './strategies/pln-iban.strategy';
import { ThbStrategyDependencies } from './strategies/thb-base.strategy';
import { EurWiseStrategy } from './strategies/eur-wise.strategy';
import { ThbBankStrategy } from './strategies/thb-bank.strategy';
import { CzkStrategyDependencies } from './strategies/czk-base.strategy';
import { CzkBankStrategy } from './strategies/czk-bank.strategy';
import { KztStrategyDependencies } from './strategies/kzt-base.strategy';
import { KztCardStrategy } from './strategies/kzt-card.strategy';
import { KztPhoneStrategy } from './strategies/kzt-phone.strategy';
import { TryStrategyDependencies } from './strategies/try-base.strategy';
import { TryIbanStrategy } from './strategies/try-iban.strategy';
import { AznStrategyDependencies } from './strategies/azn-base.strategy';
import { AznCardStrategy } from './strategies/azn-card.strategy';
import { CnyStrategyDependencies } from './strategies/cny-base.strategy';
import { CnyCardStrategy } from './strategies/cny-card.strategy';
import { UsdStrategyDependencies } from './strategies/usd-base.strategy';
import { UsdPayoneerStrategy } from './strategies/usd-payoneer.strategy';
import { KztBankCardStrategy } from './strategies/kzt-bank-card.strategy';
import { CnyAlipayStrategy } from './strategies/cny-alipay.strategy';
import { CnyWechatStrategy } from './strategies/cny-wechat.strategy';

const DEFAULT_FORM_INTRO =
  'отправьте, пожалуйста, данные строками в указанном порядке:';

type RequestAttachment = {
  requestId: string;
  photoPath: string;
};

type CnyQrWizardPayload = {
  text?: string;
  photo?: PhotoSize;
};

@Injectable()
@Wizard('create-request')
export class CreateRequestWizard {
  private readonly paymentStrategies: PaymentRequestStrategy[];

  constructor(
    private readonly requestService: RequestService,
    private readonly ratesService: RatesService,
    private readonly vendorService: VendorService,
    private readonly utilsService: UtilsService,
    private readonly telegramService: TelegramService,
    private readonly currenciesService: CurrencyService,
    private readonly prismaService: PrismaService,
  ) {
    this.paymentStrategies = this.registerStrategies();
  }

  @WizardStep(0)
  async selectMethod(@Ctx() ctx: CustomSceneContext) {
    // Check if bot is on pause
    const settings = await this.prismaService.settings.findUnique({
      where: { name: 'default' },
    });

    console.log('Bot pause status:', settings?.onPause);

    if (settings?.onPause) {
      console.log('Bot is on pause, sending notification to chat:', ctx.chat?.id);
      try {
        const chatId = ctx.chat?.id;
        if (chatId) {
          // Clear all message tracking BEFORE sending pause message
          const oldMessagesToDelete = ctx.session.messagesToDelete || [];
          const oldMenuMessages = ctx.session.requestMenuMessageId || [];

          ctx.session.messagesToDelete = [];
          ctx.session.requestMenuMessageId = [];
          ctx.session.customState = '';

          // Delete any old messages from previous attempts
          await this.deleteSceneMessages({ ...ctx, session: { ...ctx.session, messagesToDelete: oldMessagesToDelete } } as any);
          await this.deleteSceneMenuMessages({ ...ctx, session: { ...ctx.session, requestMenuMessageId: oldMenuMessages } } as any);

          // Now send the pause notification
          const sentMessage = await ctx.telegram.sendMessage(
            chatId,
            'В данный момент мы не принимаем заявки, вы получите уведомление как только мы возобновим работу.',
          );
          console.log('Pause message sent successfully, ID:', sentMessage.message_id);
        } else {
          console.warn('No chat ID available to send pause message');
        }
      } catch (error) {
        console.error('Error sending pause message:', error);
      }
      // Exit without calling scene.leave() to avoid triggering @SceneLeave hook
      return;
    }

    const username = ctx.from?.username || 'Unknown User';
    const availableCurrenciesKeyboard =
      await this.currenciesService.getCurrencyKeyboard(ctx.from?.id);
    ctx.session.messagesToDelete = ctx.session.messagesToDelete || [];
    ctx.session.requestMenuMessageId = ctx.session.requestMenuMessageId || [];
    if (
      ctx.session.customState !== 'select_currency' &&
      !ctx.session.selectedCurrencyId
    ) {
      const msg = await ctx.reply(availableCurrenciesKeyboard.caption, {
        reply_markup: availableCurrenciesKeyboard.markup,
        parse_mode: 'HTML',
      });
      ctx.session.customState = 'select_currency';
      ctx.session.requestMenuMessageId?.push(msg.message_id);
    } else {
      if (
        ctx.session.selectedCurrencyId &&
        ctx.session.requestMenuMessageId &&
        ctx.session.requestMenuMessageId.length > 0
      ) {
        const messageId = ctx.session.requestMenuMessageId[0];
        ctx.session.requestMenuMessageId =
          ctx.session.requestMenuMessageId || [];
        try {
          await ctx.telegram.editMessageText(
            ctx.chat?.id ?? 0,
            messageId,
            undefined,
            availableCurrenciesKeyboard.caption,
            {
              reply_markup: availableCurrenciesKeyboard.markup,
              parse_mode: 'HTML',
            },
          );
        } catch (error) {
          const knownMessageNotModified =
            error instanceof Error &&
            'description' in error &&
            typeof (error as any).description === 'string' &&
            (error as any).description.includes('message is not modified');

          const messageNotFound =
            error instanceof Error &&
            'description' in error &&
            typeof (error as any).description === 'string' &&
            (error as any).description.includes('message to edit not found');

          if (!knownMessageNotModified && !messageNotFound) {
            console.error('Error editing message:', error);
            // Don't throw error, just log it and continue
          } else if (messageNotFound) {
            console.warn(
              'Message to edit not found, sending new message instead',
            );
            // Send a new message instead of editing
            await ctx.reply(availableCurrenciesKeyboard.caption, {
              reply_markup: availableCurrenciesKeyboard.markup,
              parse_mode: 'HTML',
            });
          }
        }
        ctx.session.customState = 'select_currency';
        return;
      } else {
        await this.deleteSceneMessages(ctx);
        await this.deleteSceneMenuMessages(ctx);
        const msg = await ctx.reply(availableCurrenciesKeyboard.caption, {
          reply_markup: availableCurrenciesKeyboard.markup,
          parse_mode: 'HTML',
        });
        ctx.session.requestMenuMessageId?.push(msg.message_id);
        ctx.session.customState = 'select_currency';
      }
    }
  }

  @On('callback_query')
  async onCallbackQuery(@Ctx() ctx: CustomSceneContext) {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) {
      await ctx.answerCbQuery('Unknown action');
      return;
    }
    const username = ctx.from?.username || 'Unknown User';
    const selectPaymentMenu = MenuFactory.createSelectPaymentMethodMenu(
      username,
      ctx.from?.id,
    );
    let currencyId: string | undefined;
    if (callbackQuery.data.startsWith('select_currency_')) {
      // Extract currency ID and user ID from callback data
      const parts = callbackQuery.data
        .replace('select_currency_', '')
        .split('_');
      currencyId = parts[0];
      const callbackUserId = parts[1] ? parseInt(parts[1]) : null;

      // Check if this callback is for the current user
      if (callbackUserId && callbackUserId !== ctx.from?.id) {
        await ctx.answerCbQuery('Это меню другого пользователя');
        return;
      }
    }
    console.log(callbackQuery.data, 'callbackQuery.data');
    switch (true) {
      case callbackQuery.data.startsWith('select_currency_'): {
        const currency = await this.currenciesService.findById(currencyId!);
        if (!currency) {
          await ctx.answerCbQuery('Currency not found');
          return;
        }

        ctx.session.selectedCurrencyId = currency.id;
        const currencyEnum = currency.name;
        const availableMethodIds = new Set(
          (currency.Rates || []).map((rate) => rate.paymentMethodId),
        );
        const paymentMethods = currency.paymentMethod.filter((method) => {
          return availableMethodIds.has(method.id);
        });
        console.log(paymentMethods, 'paymentMethods');
        if (!paymentMethods || paymentMethods.length === 0) {
          await ctx.answerCbQuery(
            'No payment methods available for this currency',
          );
          return;
        }
        const fallbackLabels: Partial<Record<PaymentMethodEnum, string>> = {
          [PaymentMethodEnum.CARD]: BUTTON_TEXTS.CARD,
          [PaymentMethodEnum.IBAN]: BUTTON_TEXTS.IBAN,
          [PaymentMethodEnum.IBAN_COMPANY]: BUTTON_TEXTS.IBAN_COMPANY,
          [PaymentMethodEnum.WISE]: 'Wise',
          [PaymentMethodEnum.PAYPAL]: 'PayPal',
          [PaymentMethodEnum.PHONE]: 'Phone transfer',
          [PaymentMethodEnum.SKRILL]: 'Skrill / email',
          [PaymentMethodEnum.QR]: 'QR',
        };

        const paymentMethodsMeta = paymentMethods.map((method) => {
          const methodEnum = method.nameEn as PaymentMethodEnum;
          const formDefinition = PaymentFormFactory.getForm(
            currencyEnum,
            methodEnum,
          );
          const description = method.description?.trim();
          const descriptionEn = method.descriptionEn?.trim();
          const baseLabel =
            formDefinition?.title ||
            description ||
            descriptionEn ||
            fallbackLabels[methodEnum] ||
            method.nameEn;
          const buttonLabel = `${currency.code} • ${baseLabel}`;
          const instruction = formDefinition?.intro
            ? formDefinition.intro
            : descriptionEn && descriptionEn.length > 0
              ? descriptionEn
              : description && description.includes('\n')
                ? description
                : null;
          return {
            name: method.nameEn,
            buttonLabel,
            instruction,
            rawDescription: description || null,
            rawDescriptionEn: descriptionEn || null,
            form: formDefinition ?? null,
          };
        });
        ctx.session.paymentMethodsMeta = paymentMethodsMeta;

        const keyboard = await this.buildPaymentMethodKeyboard(
          ctx,
          username,
          paymentMethodsMeta,
        );
        if (keyboard) {
          await ctx.editMessageText(keyboard.caption, {
            reply_markup: keyboard.markup,
            parse_mode: 'HTML',
          });
        } else {
          await ctx.answerCbQuery('No payment methods available');
        }
        break;
      }
      case callbackQuery.data.startsWith('select_method_'): {
        // Extract method name and user ID from callback data
        const callbackData = callbackQuery.data.replace('select_method_', '');
        const lastUnderscoreIndex = callbackData.lastIndexOf('_');
        const methodName = callbackData.substring(0, lastUnderscoreIndex);
        const callbackUserId = callbackData.substring(lastUnderscoreIndex + 1)
          ? parseInt(callbackData.substring(lastUnderscoreIndex + 1))
          : null;

        // Check if this callback is for the current user
        if (callbackUserId && callbackUserId !== ctx.from?.id) {
          await ctx.answerCbQuery('Это меню другого пользователя');
          return;
        }

        const methodKey = methodName.toUpperCase();
        if (!(methodKey in PaymentMethodEnum)) {
          await ctx.answerCbQuery('Unknown payment method');
          return;
        }
        const methodEnum = methodKey as PaymentMethodEnum;
        ctx.session.requestType = methodEnum;

        // Set custom state for KZT bank methods
        if (methodEnum === PaymentMethodEnum.KZT_KASPI_BANK) {
          ctx.session.customState = 'kzt_bank_kaspi';
        } else if (methodEnum === PaymentMethodEnum.KZT_OTHER_BANKS) {
          ctx.session.customState = 'kzt_bank_other';
        }

        const instruction = this.getPaymentMethodInstruction(
          ctx,
          methodEnum,
          ctx.from?.username,
        );
        await this.showPaymentForm(ctx, methodEnum, instruction, username);
        break;
      }
      case callbackQuery.data.startsWith('return_to_request_menu'): {
        // Extract user ID from callback data
        const parts = callbackQuery.data
          .replace('return_to_request_menu_', '')
          .split('_');
        const callbackUserId = parts[0] ? parseInt(parts[0]) : null;

        // Check if this callback is for the current user
        if (callbackUserId && callbackUserId !== ctx.from?.id) {
          await ctx.answerCbQuery('Это меню другого пользователя');
          return;
        }
        const keyboard = await this.buildPaymentMethodKeyboard(ctx, username);
        if (!keyboard) {
          await this.updateSceneMenuMessage(
            ctx,
            selectPaymentMenu.caption,
            selectPaymentMenu.markup,
          );
        } else {
          await this.updateSceneMenuMessage(
            ctx,
            keyboard.caption,
            keyboard.markup,
          );
        }
        ctx.session.customState = 'select_method';
        // await this.deleteSceneMessages(ctx);
        // ctx.wizard.selectStep(0);
        break;
      }
      case callbackQuery.data.startsWith('cancel_request'): {
        // Extract user ID from callback data
        const parts = callbackQuery.data
          .replace('cancel_request_', '')
          .split('_');
        const callbackUserId = parts[0] ? parseInt(parts[0]) : null;

        // Check if this callback is for the current user
        if (callbackUserId && callbackUserId !== ctx.from?.id) {
          await ctx.answerCbQuery('Это меню другого пользователя');
          return;
        }
        await ctx.answerCbQuery('Request creation cancelled');
        await this.deleteSceneMessages(ctx);
        ctx.session.customState = '';
        await this.cancel(ctx);
        break;
      }
      case callbackQuery.data.startsWith('return_to_select_currency'): {
        // Extract user ID from callback data
        const parts = callbackQuery.data
          .replace('return_to_select_currency_', '')
          .split('_');
        const callbackUserId = parts[0] ? parseInt(parts[0]) : null;

        // Check if this callback is for the current user
        if (callbackUserId && callbackUserId !== ctx.from?.id) {
          await ctx.answerCbQuery('Это меню другого пользователя');
          return;
        }
        // await this.deleteSceneMessages(ctx);
        // await this.deleteSceneMenuMessages(ctx);
        // ctx.session.selectedCurrencyId = undefined;
        // ctx.session.requestType = undefined;
        // ctx.session.paymentMethodsMeta = undefined;
        // ctx.session.customState = '';
        await this.selectMethod(ctx);
        break;
      }
      default: {
        await ctx.scene.leave();
        break;
      }
    }
  }

  @WizardStep(1)
  async processPaymentDetails(@Ctx() ctx: CustomSceneContext) {
    const message = ctx.message as
      | (typeof ctx.message & { caption?: string; photo?: unknown })
      | undefined;

    if (!message) {
      await this.replyEphemeral(
        ctx,
        'Ожидаю текстовое сообщение с данными для заявки.',
      );
      ctx.wizard.selectStep(1);
      return;
    }

    const rawInputCandidate =
      typeof (message as { text?: string }).text === 'string'
        ? (message as { text?: string }).text
        : typeof (message as { caption?: string }).caption === 'string'
          ? (message as { caption?: string }).caption
          : '';

    const initialInput = (rawInputCandidate ?? '').trim();
    let input = initialInput;

    const selectedCurrencyId = ctx.session.selectedCurrencyId;
    const requestType = ctx.session.requestType;

    if (!selectedCurrencyId || !requestType) {
      await this.replyEphemeral(
        ctx,
        'Не удалось определить выбранную валюту или метод. Начните заново.',
      );
      ctx.wizard.selectStep(0);
      return;
    }

    const currency = await this.currenciesService.findById(selectedCurrencyId);
    if (!currency) {
      await this.replyEphemeral(
        ctx,
        'Выбранная валюта недоступна. Попробуйте снова.',
      );
      ctx.wizard.selectStep(0);
      return;
    }

    const methodEnum = requestType as PaymentMethodEnum;
    const currencyEnum = currency.name as CurrencyEnum;
    const strategy = this.resolveStrategy(currencyEnum, methodEnum);

    if (!strategy) {
      await this.replyEphemeral(
        ctx,
        'Для выбранного метода ещё не реализована обработка. Выберите другой метод.',
      );
      ctx.wizard.selectStep(0);
      return;
    }
    const isCnyPhoto =
      methodEnum === PaymentMethodEnum.CNY_ALIPAY ||
      methodEnum === PaymentMethodEnum.CNY_WECHAT;
    if (isCnyPhoto) {
      const photos = (message as { photo?: PhotoSize[] }).photo;
      if (!Array.isArray(photos) || photos.length === 0) {
        await this.replyEphemeral(
          ctx,
          'Пожалуйста, отправьте фотографию с подписью (сумма в подписи).',
        );
        ctx.wizard.selectStep(1);
        return;
      }

      const largest = photos[photos.length - 1];
      if (largest) {
        const wizardState = ctx.scene.state as {
          cnyQrPayload?: CnyQrWizardPayload;
        };
        if (!wizardState.cnyQrPayload) {
          wizardState.cnyQrPayload = {};
        }
        wizardState.cnyQrPayload.photo = largest;
        this.addPhotoMessageToDeletionList(ctx);
      }

      if (!input) {
        await this.replyEphemeral(
          ctx,
          'Пожалуйста, добавьте подпись к фото (сумма).',
        );
        ctx.wizard.selectStep(1);
        return;
      }
    } else if (!input) {
      await this.replyEphemeral(
        ctx,
        'Пожалуйста, отправьте данные в соответствии с формой.',
      );
      ctx.wizard.selectStep(1);
      return;
    }

    const strategyContext: StrategyExecuteContext = {
      ctx,
      message: input,
      method: methodEnum,
      currency: {
        id: currency.id,
        name: currencyEnum,
        code: currency.code,
      },
    };

    const result = await strategy.execute(methodEnum, strategyContext);

    if (result.status === 'error') {
      await this.replyEphemeral(ctx, `❌ ${result.error}`);
      ctx.wizard.selectStep(1);
      return;
    }

    const originalMessage = message as {
      message_id: number;
      text?: string;
      caption?: string;
    };

    await this.handleStrategySuccess(ctx, {
      requests: result.requests,
      details: result.details,
      originalMessage,
    });
  }

  async cancel(ctx: CustomSceneContext) {
    await ctx.scene.leave();
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
      const messagesToDelete = ctx.session.messagesToDelete || [];
      const chatId = ctx.chat?.id;

      console.log(
        `[RequestScene] Attempting to delete ${messagesToDelete.length} messages from chat ${chatId}`,
      );
      console.log(
        `[RequestScene] Messages to delete: ${JSON.stringify(messagesToDelete)}`,
      );
      console.log(
        `[RequestScene] Messages to pass: ${JSON.stringify(msgIdToPass)}`,
      );

      await this.telegramService.deleteAllTelegramMessages(
        messagesToDelete,
        chatId,
        msgIdToPass,
      );
      ctx.session.messagesToDelete = [];
      console.log(`[RequestScene] Successfully processed message deletion`);
    } catch (error) {
      console.error('Failed to delete scene messages:', error);
    }
  }
  async deleteSceneMenuMessages(ctx: CustomSceneContext) {
    try {
      await this.telegramService.deleteAllTelegramMessages(
        ctx.session.requestMenuMessageId,
        ctx.chat?.id,
      );
      ctx.session.requestMenuMessageId = [];
    } catch (error) {
      console.error('Failed to delete scene messages:', error);
    }
  }

  private addPhotoMessageToDeletionList(ctx: CustomSceneContext): void {
    try {
      const message = ctx.message;
      if (message && 'message_id' in message) {
        // Initialize messagesToDelete if it doesn't exist
        if (!ctx.session.messagesToDelete) {
          ctx.session.messagesToDelete = [];
        }

        // Check if message ID is already in the deletion list
        if (ctx.session.messagesToDelete.includes(message.message_id)) {
          console.log(
            `[RequestScene] Photo message ${message.message_id} already in deletion list, skipping`,
          );
          return;
        }

        // Add the photo message ID to the deletion list
        ctx.session.messagesToDelete.push(message.message_id);
        console.log(
          `[RequestScene] Photo message ${message.message_id} added to deletion list. Total messages to delete: ${ctx.session.messagesToDelete.length}`,
        );
      } else {
        console.warn(
          '[RequestScene] No valid message found to add to deletion list',
        );
      }
    } catch (error) {
      console.error(
        '[RequestScene] Failed to add photo message to deletion list:',
        error,
      );
      // Don't throw here as this is not critical
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

  private registerStrategies(): PaymentRequestStrategy[] {
    const sharedDeps: UsdStrategyDependencies &
      UahStrategyDependencies &
      EurStrategyDependencies &
      AedStrategyDependencies &
      PlnStrategyDependencies &
      ThbStrategyDependencies &
      CzkStrategyDependencies &
      KztStrategyDependencies &
      TryStrategyDependencies &
      AznStrategyDependencies &
      CnyStrategyDependencies = {
      ratesService: this.ratesService,
      requestService: this.requestService,
      vendorService: this.vendorService,
    };

    const usdDeps: UsdStrategyDependencies = sharedDeps;
    const uahDeps: UahStrategyDependencies = sharedDeps;
    const eurDeps: EurStrategyDependencies = sharedDeps;
    const aedDeps: AedStrategyDependencies = sharedDeps;
    const plnDeps: PlnStrategyDependencies = sharedDeps;
    const thbDeps: ThbStrategyDependencies = sharedDeps;
    const czkDeps: CzkStrategyDependencies = sharedDeps;
    const kztDeps: KztStrategyDependencies = sharedDeps;
    const tryDeps: TryStrategyDependencies = sharedDeps;
    const aznDeps: AznStrategyDependencies = sharedDeps;
    const cnyDeps: CnyStrategyDependencies = sharedDeps;

    return [
      new UsdCardStrategy({
        ...usdDeps,
        utilsService: this.utilsService,
      }),
      new UsdPayoneerStrategy(usdDeps),
      new UsdSkrillEmailStrategy(usdDeps),
      new UsdWiseStrategy(usdDeps),
      new UsdPayPalStrategy(usdDeps),
      new UahCardStrategy({
        ...uahDeps,
        utilsService: this.utilsService,
      }),
      new UahIbanStrategy(uahDeps),
      new UahIbanCompanyStrategy(uahDeps),
      new EurCardStrategy({
        ...eurDeps,
        utilsService: this.utilsService,
      }),
      new EurIbanStrategy(eurDeps),
      new EurIbanBusinessStrategy(eurDeps),
      new EurSkrillEmailStrategy(eurDeps),
      new EurWiseStrategy(eurDeps),
      new AedIbanStrategy(aedDeps),
      new PlnIbanStrategy(plnDeps),
      new ThbBankStrategy(thbDeps),
      new CzkBankStrategy(czkDeps),
      new KztBankCardStrategy({
        ...kztDeps,
        utilsService: this.utilsService,
      }),
      new KztPhoneStrategy(kztDeps),
      new TryIbanStrategy(tryDeps),
      new AznCardStrategy({
        ...aznDeps,
        utilsService: this.utilsService,
      }),
      new AznOtherBanksStrategy({
        ...aznDeps,
        utilsService: this.utilsService,
      }),
      new CnyAlipayStrategy(cnyDeps),
      new CnyWechatStrategy(cnyDeps),
      new CnyCardStrategy(cnyDeps),
      // Form-driven directions (GBP, SEK, MDL, ...): keep LAST so that
      // dedicated strategies above always win for their currency+method.
      new GenericFormStrategy(sharedDeps),
    ];
  }
  private async buildPaymentMethodKeyboard(
    ctx: CustomSceneContext,
    username: string,
    paymentMethodsMeta?: CustomSceneContext['session']['paymentMethodsMeta'],
  ): Promise<{ caption: string; markup: InlineKeyboardMarkup } | null> {
    const meta =
      paymentMethodsMeta ?? ctx.session.paymentMethodsMeta ?? undefined;
    if (!meta || meta.length === 0) {
      return null;
    }

    ctx.session.paymentMethodsMeta = meta;
    const methodButtons = meta.map((item) =>
      Markup.button.callback(
        item.buttonLabel,
        `select_method_${item.name.toLowerCase()}_${ctx.from?.id || ''}`,
      ),
    );
    const rows: InlineKeyboardButton[][] = [];
    const perRow = 2;
    for (let i = 0; i < methodButtons.length; i += perRow) {
      rows.push(methodButtons.slice(i, i + perRow));
    }

    const selectPaymentMenu = MenuFactory.createSelectPaymentMethodMenu(
      username,
      ctx.from?.id,
    );
    const cancelButton = Markup.button.callback(
      BUTTON_TEXTS.BACK,
      `return_to_select_currency_${ctx.from?.id || ''}`,
    );
    const markup = Markup.inlineKeyboard([
      ...rows,
      [cancelButton],
    ]).reply_markup;

    return {
      caption: selectPaymentMenu.caption,
      markup,
    };
  }

  private async showPaymentForm(
    ctx: CustomSceneContext,
    method: PaymentMethodEnum,
    instruction: string | null,
    username?: string,
  ) {
    const caption =
      instruction ||
      this.getDefaultFormCaption(method, username) ||
      'Введите данные для заявки:';
    const markup = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          BUTTON_TEXTS.BACK,
          `${BUTTON_CALLBACKS.RETURN_TO_REQUEST_MENU}_${ctx.from?.id || ''}`,
        ),
      ],
      [
        Markup.button.callback(
          BUTTON_TEXTS.CANCEL,
          `${BUTTON_CALLBACKS.CANCEL_REQUEST}_${ctx.from?.id || ''}`,
        ),
      ],
    ]).reply_markup;

    await this.updateSceneMenuMessage(ctx, caption, markup);

    ctx.wizard.selectStep(1);
  }

  private getDefaultFormCaption(
    method: PaymentMethodEnum,
    username?: string,
  ): string | null {
    const baseCaption =
      method === PaymentMethodEnum.CARD
        ? '@username отправьте, пожалуйста, данные карты.'
        : '@username отправьте, пожалуйста, данные для перевода.';
    if (!username) {
      return baseCaption.replace('@username', '').trim();
    }
    return baseCaption.replace('@username', `@${username}`).trim();
  }

  private getPaymentMethodMeta(
    ctx: CustomSceneContext,
    method: PaymentMethodEnum,
  ) {
    const methodName =
      typeof method === 'string' ? method.toUpperCase() : method;
    return (
      ctx.session.paymentMethodsMeta?.find(
        (item) => item.name === methodName,
      ) ?? null
    );
  }

  private getPaymentMethodInstruction(
    ctx: CustomSceneContext,
    method: PaymentMethodEnum,
    username?: string,
  ): string | null {
    const meta = this.getPaymentMethodMeta(ctx, method);
    if (meta?.form) {
      return this.renderFormInstruction(meta.form, username);
    }
    const candidateInstruction = meta?.instruction?.trim();
    if (candidateInstruction) {
      return this.prependUsername(candidateInstruction, username);
    }
    const fallback = meta?.rawDescriptionEn || meta?.rawDescription;
    if (fallback) {
      return this.prependUsername(fallback, username);
    }
    return null;
  }

  private renderFormInstruction(
    form: PaymentMethodFormDefinition,
    username?: string,
  ): string {
    const segments: string[] = [];
    const intro = form.intro || DEFAULT_FORM_INTRO;
    const introWithUsername = this.prependUsername(intro, username);
    segments.push(introWithUsername);

    if (form.fields?.length) {
      const lines = form.fields.map((field, index) => {
        const base = `${index + 1}. ${field.label}${field.optional ? ' (по желанию)' : ''}`;
        const details: string[] = [];
        if (field.description) {
          details.push(field.description);
        }
        if (field.example) {
          details.push(`пример: ${field.example}`);
        }
        return details.length ? `${base} — ${details.join(', ')}` : base;
      });
      segments.push(lines.join('\n'));
    }

    if (form.sample) {
      segments.push(`Пример сообщения:\n${form.sample}`);
    }

    if (form.notes?.length) {
      segments.push(form.notes.map((note) => `⚠️ ${note}`).join('\n'));
    }

    return segments.join('\n\n');
  }

  private prependUsername(text: string, username?: string): string {
    if (!username) {
      return text;
    }
    if (text.includes(`@${username}`)) {
      return text;
    }
    return `@${username} ${text}`.trim();
  }

  private resolveStrategy(
    currency: CurrencyEnum,
    method: PaymentMethodEnum,
  ): PaymentRequestStrategy | undefined {
    return this.paymentStrategies.find((strategy) => {
      console.log('strategy', currency, method);
      return strategy.supports(currency, method);
    });
  }

  private async replyEphemeral(ctx: CustomSceneContext, text: string) {
    try {
      const message = await ctx.reply(text, {
        parse_mode: 'HTML',
      });
      if (!ctx.session.messagesToDelete) {
        ctx.session.messagesToDelete = [];
      }
      ctx.session.messagesToDelete.push(message.message_id);
      return message;
    } catch (error) {
      console.error('Failed to send ephemeral message:', error);
      return null;
    }
  }

  private async handleStrategySuccess(
    ctx: CustomSceneContext,
    payload: {
      requests: FullRequestType[];
      details: string[];
      originalMessage: { message_id: number; text?: string };
      attachments?: RequestAttachment[];
    },
  ) {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      await this.replyEphemeral(
        ctx,
        'Не удалось определить чат. Заявки созданы, но уведомления могут не сохраниться.',
      );
      return;
    }

    const wizardState = ctx.scene.state as {
      cnyQrPayload?: CnyQrWizardPayload;
    };
    if (wizardState.cnyQrPayload) {
      delete wizardState.cnyQrPayload;
    }

    if (!ctx.session.messagesToDelete) {
      ctx.session.messagesToDelete = [];
    }

    const defaultPhotoUrl = './src/assets/0056.jpg';

    try {
      for (let index = 0; index < payload.requests.length; index++) {
        const request = payload.requests[index];
        const attachment = payload.attachments?.find(
          (item) => item.requestId === request.id,
        );

        // Check scene state for photo path (for new CNY QR requests)
        let photoUrl = attachment?.photoPath ?? defaultPhotoUrl;
        if (ctx) {
          const state = ctx.scene.state as {
            cnyQrPhotoPath?: string;
          };
          if (state.cnyQrPhotoPath) {
            photoUrl = state.cnyQrPhotoPath;
            console.log(
              `[RequestScene] Using photo path from scene state: ${photoUrl}`,
            );
          }
        }

        const photoBuffer =
          photoUrl !== defaultPhotoUrl
            ? await this.loadPhotoBuffer(photoUrl)
            : undefined;
        const publicMenu = MenuFactory.createPublicMenu(
          request as unknown as FullRequestType,
          photoUrl,
          photoBuffer,
        );

        const publicPayload = publicMenu.inWork();

        // Handle HTTP URLs vs local files/buffers
        let photoSource;
        if (publicPayload.url && publicPayload.url.startsWith('http')) {
          // It's a Telegram CDN URL, use it directly
          photoSource = publicPayload.url;
        } else if (publicPayload.source) {
          // Use the provided buffer/stream
          photoSource = { source: publicPayload.source };
        } else {
          // Fallback to URL as file path
          photoSource = { source: createReadStream(publicPayload.url) };
        }

        const menuMessage = await ctx.replyWithPhoto(photoSource, {
          caption: publicPayload.caption,
          reply_markup: publicPayload.markup,
          parse_mode: 'HTML',
        });

        await this.persistMessageSafely(
          request.id,
          {
            chatId,
            messageId: menuMessage.message_id,
            text: publicPayload.caption,
            photoUrl,
          },
          ctx,
        );
      }
    } catch (error) {
      console.error('Failed to finalize request flow:', error);
      await this.replyEphemeral(
        ctx,
        '⚠️ Заявка создана, но возникла ошибка при отправке уведомления.',
      );
    } finally {
      this.resetSession(ctx);
      await this.cancel(ctx);
    }
  }

  private resetSession(ctx: CustomSceneContext) {
    ctx.session.customState = '';
    ctx.session.requestType = undefined;
    ctx.session.selectedCurrencyId = undefined;
    ctx.session.paymentMethodsMeta = undefined;
  }

  private resolvePhotoPath(photoUrl: string): string {
    if (/^https?:\/\//i.test(photoUrl)) {
      return photoUrl;
    }
    const normalized = photoUrl.startsWith('./') ? photoUrl.slice(2) : photoUrl;
    return path.isAbsolute(normalized)
      ? normalized
      : path.join(process.cwd(), normalized);
  }

  private async loadPhotoBuffer(photoUrl: string): Promise<Buffer | undefined> {
    try {
      const resolvedPath = this.resolvePhotoPath(photoUrl);
      if (resolvedPath.startsWith('http')) {
        return undefined;
      }
      return await fs.readFile(resolvedPath);
    } catch (error) {
      console.error('Failed to load photo buffer from', photoUrl, error);
      return undefined;
    }
  }

  private async persistMessageSafely(
    requestId: string,
    payload: {
      chatId: number;
      messageId: number;
      text: string;
      photoUrl?: string;
    },
    ctx?: CustomSceneContext,
  ) {
    try {
      // Check if there's a photo path stored in scene state (for CNY QR requests)
      let finalPhotoUrl = payload.photoUrl ?? '';
      if (ctx) {
        const state = ctx.scene.state as {
          cnyQrPhotoPath?: string;
        };
        if (state.cnyQrPhotoPath) {
          finalPhotoUrl = state.cnyQrPhotoPath;
          console.log(
            `[RequestScene] Using photo path from scene state: ${finalPhotoUrl}`,
          );
        }
      }

      await this.requestService.insertCardRequestMessage(requestId, {
        chatId: BigInt(payload.chatId),
        messageId: payload.messageId,
        text: payload.text,
        photoUrl: finalPhotoUrl,
        requestId,
        accessType: AccessType.PUBLIC,
      });
    } catch (error) {
      console.error('Failed to persist message for request', requestId, error);
    }
  }

  parseIbanRequest(input: string) {
    const lines = input
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 3) {
      throw new Error('Недостаточно данных для IBAN заявки.');
    }

    const ibanRegex = /^[A-Z]{2}[0-9A-Z]{10,}$/i;
    const amountRegex = /^\d+(?:[.,]\d{1,2})?$/;
    const innRegex = /^\d{8}$|^\d{10}$/;

    const ibanIndex = lines.findIndex((line) =>
      ibanRegex.test(line.replace(/\s+/g, '').toUpperCase()),
    );

    if (ibanIndex === -1) {
      throw new Error('Строка с IBAN не найдена.');
    }

    const iban = lines[ibanIndex].replace(/\s+/g, '').toUpperCase();

    let amountIndex = -1;
    for (let i = ibanIndex + 1; i < lines.length; i += 1) {
      const cleaned = lines[i].replace(',', '.').replace(/[^\d.]/g, '');
      if (cleaned && amountRegex.test(cleaned)) {
        amountIndex = i;
        break;
      }
    }
    if (amountIndex === -1) {
      for (let i = 0; i < lines.length; i += 1) {
        if (i === ibanIndex) continue;
        const cleaned = lines[i].replace(',', '.').replace(/[^\d.]/g, '');
        if (cleaned && amountRegex.test(cleaned)) {
          amountIndex = i;
          break;
        }
      }
    }
    if (amountIndex === -1) {
      throw new Error('Сумма должна быть числом, например: 1000.00');
    }
    const amountStr = lines[amountIndex]
      .replace(',', '.')
      .replace(/[^\d.]/g, '');
    const amount = parseFloat(amountStr);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Сумма должна быть положительным числом.');
    }

    // Detect name: prefer line before IBAN, otherwise after
    let name = '';
    const candidateBefore = ibanIndex > 0 ? lines[ibanIndex - 1] : '';
    const candidateAfter =
      ibanIndex < lines.length - 1 ? lines[ibanIndex + 1] : '';
    const isAmount = (value: string) =>
      amountRegex.test(value.replace(',', '.').replace(/[^\d.]/g, ''));
    const isInnValue = (value: string) =>
      innRegex.test(value.replace(/\D/g, ''));

    if (
      candidateBefore &&
      !isAmount(candidateBefore) &&
      !isInnValue(candidateBefore)
    ) {
      name = candidateBefore;
    } else if (
      candidateAfter &&
      !isAmount(candidateAfter) &&
      !isInnValue(candidateAfter)
    ) {
      name = candidateAfter;
    }

    let inn = '';
    let innIndex = lines.findIndex((line, idx) => {
      if (idx === ibanIndex || idx === amountIndex) return false;
      return innRegex.test(line.replace(/\D/g, ''));
    });
    if (innIndex !== -1) {
      inn = lines[innIndex].replace(/\D/g, '');
    }

    if (iban.startsWith('UA') && !inn) {
      throw new Error('ИНН обязателен для IBAN заявок UA.');
    }

    const usedIndexes = new Set([ibanIndex, amountIndex]);
    if (name) {
      const nameIdx = lines.indexOf(name);
      if (nameIdx !== -1) {
        usedIndexes.add(nameIdx);
      }
    }
    if (innIndex !== -1) {
      usedIndexes.add(innIndex);
    }

    const comment = lines
      .filter((_, idx) => !usedIndexes.has(idx))
      .join('\n')
      .trim();

    return {
      name,
      iban,
      inn,
      amount,
      comment,
    };
  }
}
