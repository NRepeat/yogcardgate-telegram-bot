import { Injectable } from '@nestjs/common';
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
} from 'src/types/types';
import { TelegramService } from '../telegram.service';
import {
  InlineKeyboardButton,
  InlineKeyboardMarkup,
} from 'telegraf/typings/core/types/typegram';
import {
  BUTTON_CALLBACKS,
  BUTTON_TEXTS,
  MenuFactory,
} from '../telegram-keyboards';
import { CurrencyService } from 'src/modules/currencie/currencie.service';
import { Markup } from 'telegraf';
import { AccessType, CurrencyEnum, PaymentMethodEnum } from '@prisma/client';
import { PaymentFormFactory } from './payment-form.factory';
import {
  PaymentRequestStrategy,
  StrategyExecuteContext,
} from './strategies/payment-request.strategy';
import { UsdCardStrategy } from './strategies/usd-card.strategy';
import { UsdSkrillEmailStrategy } from './strategies/usd-skrill-email.strategy';
import { UsdWireStrategy } from './strategies/usd-wire.strategy';
import { UahCardStrategy } from './strategies/uah-card.strategy';
import { UahIbanStrategy } from './strategies/uah-iban.strategy';
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
import { ThbWireStrategy } from './strategies/thb-wire.strategy';
import { CzkStrategyDependencies } from './strategies/czk-base.strategy';
import { CzkWireStrategy } from './strategies/czk-wire.strategy';
import { KztStrategyDependencies } from './strategies/kzt-base.strategy';
import { KztCardStrategy } from './strategies/kzt-card.strategy';
import { KztPhoneStrategy } from './strategies/kzt-phone.strategy';
import { TryStrategyDependencies } from './strategies/try-base.strategy';
import { TryIbanStrategy } from './strategies/try-iban.strategy';
import { AznStrategyDependencies } from './strategies/azn-base.strategy';
import { AznCardStrategy } from './strategies/azn-card.strategy';
import { CnyStrategyDependencies } from './strategies/cny-base.strategy';
import { CnyQrStrategy } from './strategies/cny-qr.strategy';
import { UsdStrategyDependencies } from './strategies/usd-base.strategy';

const DEFAULT_FORM_INTRO =
  'отправьте, пожалуйста, данные строками в указанном порядке:';

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
  ) {
    this.paymentStrategies = this.registerStrategies();
  }

  @WizardStep(0)
  async selectMethod(@Ctx() ctx: CustomSceneContext) {
    const username = ctx.from?.username || 'Unknown User';
    const availableCurrenciesKeyboard =
      await this.currenciesService.getCurrencyKeyboard();
    ctx.session.messagesToDelete = ctx.session.messagesToDelete || [];
    ctx.session.requestMenuMessageId = ctx.session.requestMenuMessageId || [];
    console.log(ctx.session)
    if (ctx.session.customState !== 'select_currency' && !ctx.session.selectedCurrencyId) {
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
        ctx.session.requestMenuMessageId = ctx.session.requestMenuMessageId || [];
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
          if (!knownMessageNotModified) {
            throw error;
          }
        }
        ctx.session.customState = 'select_currency';
        return 
      }else{
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
    const selectPaymentMenu =
      MenuFactory.createSelectPaymentMethodMenu(username);
    let currencyId: string | undefined;
    if (callbackQuery.data.startsWith('select_currency_')) {
      currencyId = callbackQuery.data.replace('select_currency_', '');
    }
    console.log(callbackQuery.data, 'callbackQuery.data')
    switch (true) {
      case callbackQuery.data.startsWith('select_currency_'): {
        const currency = await this.currenciesService.findById(currencyId!);
        if (!currency) {
          await ctx.answerCbQuery('Currency not found');
          return;
        }

        ctx.session.selectedCurrencyId = currency.id;
        const currencyEnum = currency.name as CurrencyEnum;
        console.log('currency.Rates ',currency.Rates )
        const availableMethodIds = new Set(
          (currency.Rates || []).map((rate) => rate.paymentMethodId),
        );
        console.log(currency,'availableMethodIds')
        const paymentMethods = currency.paymentMethod.filter((method) => {
          console.log(method,'method')
          return availableMethodIds.has(method.id)
         
        }
      
        );
        console.log(paymentMethods,'paymentMethods')
        if (!paymentMethods || paymentMethods.length === 0) {
          await ctx.answerCbQuery(
            'No payment methods available for this currency',
          );
          return;
        }
        const fallbackLabels: Partial<Record<PaymentMethodEnum, string>> = {
          [PaymentMethodEnum.CARD]: BUTTON_TEXTS.CARD,
          [PaymentMethodEnum.IBAN]: BUTTON_TEXTS.IBAN,
          [PaymentMethodEnum.WIRE]: 'Bank transfer',
          [PaymentMethodEnum.PHONE]: 'Phone transfer',
          [PaymentMethodEnum.SKRILL_EMAIL]: 'Skrill / email',
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
        const methodKey = callbackQuery.data
          .replace('select_method_', '')
          .toUpperCase();
        if (!(methodKey in PaymentMethodEnum)) {
          await ctx.answerCbQuery('Unknown payment method');
          return;
        }
        const methodEnum = methodKey as PaymentMethodEnum;
        ctx.session.requestType = methodEnum;
        const instruction = this.getPaymentMethodInstruction(
          ctx,
          methodEnum,
          ctx.from?.username,
        );
        await this.showPaymentForm(ctx, methodEnum, instruction, username);
        break;
      }
      case callbackQuery.data === 'return_to_request_menu': {
        const keyboard = await this.buildPaymentMethodKeyboard(
          ctx,
          username,
        );
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
      case callbackQuery.data === 'cancel_request': {
        await ctx.answerCbQuery('Request creation cancelled');
        await this.deleteSceneMessages(ctx);
        ctx.session.customState = '';
        await this.cancel(ctx);
        break;
      }
      case callbackQuery.data === "return_to_select_currency": {
        // await this.deleteSceneMessages(ctx);
        // await this.deleteSceneMenuMessages(ctx);
        // ctx.session.selectedCurrencyId = undefined;
        // ctx.session.requestType = undefined;
        // ctx.session.paymentMethodsMeta = undefined;
        // ctx.session.customState = '';
        await this.selectMethod(ctx)
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
    const message = ctx.message;
    if (!message || !('text' in message)) {
      await this.replyEphemeral(
        ctx,
        'Ожидаю текстовое сообщение с данными для заявки.',
      );
      ctx.wizard.selectStep(1);
      return;
    }

    const input = (message.text || '').trim();
    if (!input) {
      await this.replyEphemeral(
        ctx,
        'Пожалуйста, отправьте данные в соответствии с формой.',
      );
      ctx.wizard.selectStep(1);
      return;
    }

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

    const strategyContext: StrategyExecuteContext = {
      ctx,
      message: input,
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

    const originalMessage = message as { message_id: number; text?: string };
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
      await this.telegramService.deleteAllTelegramMessages(
        ctx.session.requestMenuMessageId,
        ctx.chat?.id,
      );
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
      new UsdSkrillEmailStrategy(usdDeps),
      new UsdWireStrategy(usdDeps),
      new UahCardStrategy({
        ...uahDeps,
        utilsService: this.utilsService,
      }),
      new UahIbanStrategy(uahDeps),
      new EurCardStrategy({
        ...eurDeps,
        utilsService: this.utilsService,
      }),
      new EurIbanStrategy(eurDeps),
      new EurSkrillEmailStrategy(eurDeps),
      new AedIbanStrategy(aedDeps),
      new PlnIbanStrategy(plnDeps),
      new ThbWireStrategy(thbDeps),
      new CzkWireStrategy(czkDeps),
      new KztCardStrategy({
        ...kztDeps,
        utilsService: this.utilsService,
      }),
      new KztPhoneStrategy(kztDeps),
      new TryIbanStrategy(tryDeps),
      new AznCardStrategy({
        ...aznDeps,
        utilsService: this.utilsService,
      }),
      new CnyQrStrategy(cnyDeps),
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
        `select_method_${item.name.toLowerCase()}`,
      ),
    );
    const rows: InlineKeyboardButton[][] = [];
    const perRow = 2;
    for (let i = 0; i < methodButtons.length; i += perRow) {
      rows.push(methodButtons.slice(i, i + perRow));
    }

    const selectPaymentMenu =
      MenuFactory.createSelectPaymentMethodMenu(username);
    const cancelButton = Markup.button.callback(
      BUTTON_TEXTS.BACK,
      'return_to_select_currency',
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
          BUTTON_CALLBACKS.RETURN_TO_REQUEST_MENU,
        ),
      ],
      [
        Markup.button.callback(
          BUTTON_TEXTS.CANCEL,
          BUTTON_CALLBACKS.CANCEL_REQUEST,
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
    method: PaymentMethodEnum | string,
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
    return this.paymentStrategies.find((strategy) =>
      strategy.supports(currency, method),
    );
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

    const photoUrl = './src/assets/0056.jpg';

    for (let index = 0; index < payload.requests.length; index++) {
      const request = payload.requests[index];
      const detail = payload.details[index] ?? '';



      const publicMenu = MenuFactory.createPublicMenu(
        request as unknown as FullRequestType,
        photoUrl,
      );

      const publicPayload = publicMenu.inWork();
      const menuMessage = await ctx.replyWithPhoto(
        {
          source: publicPayload.source,
        },
        {
          caption: publicPayload.caption,
          reply_markup: publicPayload.markup,
          parse_mode: 'HTML',
        },
      );

      await this.persistMessageSafely(request.id, {
        chatId,
        messageId: menuMessage.message_id,
        text: publicPayload.caption,
        photoUrl,
      });
    }

    this.resetSession(ctx);
    await this.cancel(ctx);
  }

  private resetSession(ctx: CustomSceneContext) {
    ctx.session.customState = '';
    ctx.session.requestType = undefined;
    ctx.session.selectedCurrencyId = undefined;
    ctx.session.paymentMethodsMeta = undefined;
  }

  private async persistMessageSafely(
    requestId: string,
    payload: { chatId: number; messageId: number; text: string; photoUrl?: string },
  ) {
    try {
      await this.requestService.insertCardRequestMessage(requestId, {
        chatId: BigInt(payload.chatId),
        messageId: payload.messageId,
        text: payload.text,
        photoUrl: payload.photoUrl ?? '',
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
    const isInnValue = (value: string) => innRegex.test(value.replace(/\D/g, ''));

    if (candidateBefore && !isAmount(candidateBefore) && !isInnValue(candidateBefore)) {
      name = candidateBefore;
    } else if (candidateAfter && !isAmount(candidateAfter) && !isInnValue(candidateAfter)) {
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
