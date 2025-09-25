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
import { CurrencyEnum, PaymentMethodEnum } from '@prisma/client';
import { PaymentFormFactory } from './payment-form.factory';
import {
  PaymentRequestStrategy,
  StrategyExecuteContext,
} from './strategies/payment-request.strategy';
import { UsdCardStrategy } from './strategies/usd-card.strategy';
import { UsdSkrillEmailStrategy } from './strategies/usd-skrill-email.strategy';
import { UsdWireStrategy } from './strategies/usd-wire.strategy';
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
    const selectPaymentMenu =
      MenuFactory.createSelectPaymentMethodMenu(username);
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
        return 
      }else{
        await this.deleteSceneMessages(ctx);
        await this.deleteSceneMenuMessages(ctx);
        const msg = await ctx.reply(availableCurrenciesKeyboard.caption, {
          reply_markup: availableCurrenciesKeyboard.markup,
          parse_mode: 'HTML',
        });
        ctx.session.requestMenuMessageId?.push(msg.message_id);
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
        const availableMethodIds = new Set(
          (currency.Rates || []).map((rate) => rate.paymentMethodId),
        );
        const paymentMethods = currency.paymentMethod.filter((method) =>
          availableMethodIds.has(method.id),
        );
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
    if (!this.isAwaitingForm(ctx)) {
      await this.replyEphemeral(
        ctx,
        'Не удалось определить текущий шаг. Начните создание заявки заново.',
      );
      ctx.wizard.selectStep(0);
      return;
    }

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
      request: result.request,
      details: result.details,
      originalMessage,
    });
  }

  // @WizardStep(1)
  // async cardStep(@Ctx() ctx: CustomSceneContext) {
  //   const message = ctx.text;
  //   const chatId = ctx.chat?.id;
  //   if (!chatId) {
  //     await ctx.reply('Chat ID not found. Please try again.');
  //     return;
  //   }
  //   if (!message || message.trim().length === 0) {
  //     await ctx.reply('Please provide card details.');
  //     return;
  //   }
  //   const lines = message
  //     .split('\n')
  //     .map((line) => line.trim())
  //     .filter((line) => line.length > 0);
  //   const cardRegex =
  //     /^(?:4[0-9]{12}(?:[0-9]{3})?|[25][1-7][0-9]{14}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11})$/;
  //   const amountRegex = /^\d+(\.\d{1,2})?$/;
  //   const cardDetails: { cardNumber: string; amount: number }[] = [];

  //   for (const line of lines) {
  //     if (line.split(' ').length < 2) {
  //       const msg = await ctx.reply(
  //         '❌ Неверный формат ввода! Используйте фомат "карта сумма"',
  //       );
  //       ctx.session.messagesToDelete?.push(msg.message_id);
  //       ctx.wizard.selectStep(1);
  //       continue;
  //     }
  //     if (
  //       !cardRegex.test(line.split(' ')[0]) ||
  //       !amountRegex.test(line.split(' ')[1] || '0')
  //     ) {
  //       const msg = await ctx.reply(
  //         '❌ Неверный номер карты!\nИспользуйте фомат "карта сумма"',
  //       );
  //       ctx.session.messagesToDelete?.push(msg.message_id);
  //       ctx.wizard.selectStep(1);
  //       continue;
  //     }
  //     cardDetails.push({
  //       cardNumber: line.split(' ')[0],
  //       amount: parseFloat(line.split(' ')[1] || '0'),
  //     });
  //   }
  //   if (cardDetails.length !== 0) {
  //     for (const [index, cardDetail] of cardDetails.entries()) {
  //       const rates = await this.ratesService.getAllRates();
  //       if (!rates || rates.length === 0) {
  //         const msg = await ctx.reply('Нед доступного курса для данной суммы.');
  //         ctx.session.messagesToDelete?.push(msg.message_id);
  //         ctx.wizard.selectStep(1);
  //         return;
  //       }
  //       const currentCurrencyId = ctx.session.selectedCurrencyId;
  //       if (!currentCurrencyId) {
  //         const msg = await ctx.reply(
  //           'Валюта не выбрана. Пожалуйста, выберите валюту.',
  //         );
  //         ctx.session.messagesToDelete?.push(msg.message_id);
  //         ctx.wizard.selectStep(0);
  //         return;
  //       }
  //       console.log('ctx.state.requestType', ctx.state);
  //       const currency =
  //         await this.currenciesService.findById(currentCurrencyId);
  //       const foundRate = rates.find((rate) => {
  //         if (
  //           rate.paymentMethod.nameEn.toLowerCase() ===
  //           ctx.session.requestType?.toLowerCase() &&
  //           rate.currency.nameEn === currency?.nameEn
  //         ) {
  //           return (
  //             cardDetail.amount >= rate.minAmount &&
  //             (rate.maxAmount === 0 || cardDetail.amount <= rate.maxAmount)
  //           );
  //         }
  //       });
  //       const vendor = await this.vendorService.getVendorByChatId(chatId);
  //       if (!vendor) {
  //         const msg = await ctx.reply(
  //           'Пользователь не найден в базе данных. Пожалуйста, свяжитесь с администратором.',
  //         );
  //         ctx.session.messagesToDelete?.push(msg.message_id);
  //         ctx.wizard.selectStep(1);
  //         return;
  //       }
  //       if (!foundRate) {
  //         const msg = await ctx.reply('Нед доступного курса для данной суммы.');
  //         ctx.session.messagesToDelete?.push(msg.message_id);
  //         ctx.wizard.selectStep(1);
  //         return;
  //       }

  //       const requestExists =
  //         cardDetails.findIndex(
  //           (detail, idx) =>
  //             detail.cardNumber === cardDetail.cardNumber &&
  //             detail.amount === cardDetail.amount &&
  //             idx !== index,
  //         ) !== -1;

  //       if (requestExists) {
  //         const msg = await ctx.reply(
  //           `Заявка для карты ${cardDetail.cardNumber} с  ${cardDetail.amount} уже существует.`,
  //         );
  //         ctx.session.messagesToDelete?.push(msg.message_id);
  //         ctx.wizard.selectStep(1);
  //         return;
  //       }
  //       const bankName = await this.utilsService.getBankNameByCardNumber(
  //         cardDetail.cardNumber,
  //       );
  //       const cardRequest: CardRequestType = {
  //         amount: cardDetail.amount,
  //         currencyId: foundRate.currencyId,
  //         notificationSent: false,
  //         status: 'PENDING',
  //         vendorId: vendor?.id,
  //         rateId: foundRate.id,
  //         rate: String(foundRate.rate),
  //         card: {
  //           card: cardDetail.cardNumber,
  //           comment: 'Card request created via bot',
  //           bankId: bankName ? bankName.id : '',
  //         },
  //       };
  //       try {
  //         const request =
  //           await this.requestService.createCardRequest(cardRequest);
  //         const photoUrl = './src/assets/0056.jpg';
  //         const publicMenu = MenuFactory.createPublicMenu(
  //           request as unknown as FullRequestType,
  //           photoUrl,
  //         );
  //         const requestMessage = await ctx.replyWithPhoto(
  //           {
  //             source: publicMenu.inWork().source,
  //           },
  //           {
  //             caption: publicMenu.inWork().caption,
  //             reply_markup: publicMenu.inWork().markup,
  //             parse_mode: 'HTML',
  //           },
  //         );
  //         if (!requestMessage || !request) {
  //           return;
  //         }
  //         const messageToSave: SerializedMessage = {
  //           photoUrl: photoUrl,
  //           text: publicMenu.inWork().caption,
  //           chatId: BigInt(ctx.chat?.id || 0),
  //           messageId: requestMessage.message_id,
  //           requestId: request.id,
  //           accessType: 'PUBLIC',
  //         };
  //         await this.requestService.insertCardRequestMessage(
  //           request.id,
  //           messageToSave,
  //         );
  //       } catch (error) {
  //         console.error('Error creating card request:', error);
  //         await this.cancel(ctx);
  //         return;
  //       }
  //     }
  //     await this.cancel(ctx);
  //   }
  // }

  // @WizardStep(2)
  // async ibanStep(@Ctx() ctx: CustomSceneContext) {
  //   const input = ctx.text;
  //   if (!input || input.split('\n').length < 4) {
  //     await ctx.reply(
  //       'Пожалуйста, введите данные в формате:\nИмя\nIBAN\nИНН\nСумма\nКомментарий (если нужно)',
  //     );
  //     ctx.wizard.selectStep(2);
  //     return;
  //   }
  //   const chatId = ctx.chat?.id;
  //   if (!chatId) {
  //     return;
  //   }
  //   try {
  //     let ibanRawData;
  //     try {
  //       ibanRawData = this.parseIbanRequest(input);
  //     } catch (error) {
  //       await ctx.sendMessage(`${error.message}`);
  //       return;
  //     }
  //     const rates = await this.ratesService.getAllRates();
  //     if (!rates || rates.length === 0) {
  //       const msg = await ctx.reply('Нед доступного курса для данной суммы.');
  //       ctx.session.messagesToDelete?.push(msg.message_id);
  //       ctx.wizard.selectStep(1);
  //       return;
  //     }
  //     const foundRate = rates.find((rate) => {
  //       if (
  //         rate.paymentMethod.nameEn === 'IBAN' &&
  //         rate.currency.nameEn === 'UAH'
  //       ) {
  //         return (
  //           ibanRawData.amount >= rate.minAmount &&
  //           (rate.maxAmount === 0 || ibanRawData.amount <= rate.maxAmount)
  //         );
  //       }
  //     });
  //     const vendor = await this.vendorService.getVendorByChatId(chatId);
  //     if (!vendor) {
  //       const msg = await ctx.reply(
  //         'Пользователь не найден в базе данных. Пожалуйста, свяжитесь с администратором.',
  //       );
  //       ctx.session.messagesToDelete?.push(msg.message_id);
  //       // ctx.wizard.selectStep(2);
  //       return;
  //     }
  //     if (!foundRate) {
  //       const msg = await ctx.reply('Нед доступного курса для данной суммы.');
  //       ctx.session.messagesToDelete?.push(msg.message_id);
  //       // ctx.wizard.selectStep(2);
  //       return;
  //     }
  //     const ibanRequest: IbanRequestType = {
  //       amount: ibanRawData.amount,
  //       currencyId: foundRate.currencyId,
  //       notificationSent: false,
  //       status: 'PENDING',
  //       vendorId: vendor?.id,
  //       rate: String(foundRate.rate),
  //       rateId: foundRate.id,
  //       iban: {
  //         iban: ibanRawData.iban,
  //         inn: ibanRawData.inn,
  //         name: ibanRawData.name,
  //         comment: ibanRawData.comment || '',
  //       },
  //     };
  //     const request = await this.requestService.createIbanRequest(ibanRequest);

  //     const photoUrl = './src/assets/0056.jpg';
  //     const publicMenu = MenuFactory.createPublicMenu(
  //       request as unknown as FullRequestType,
  //       photoUrl,
  //     );
  //     const requestMessage = await ctx.replyWithPhoto(
  //       {
  //         source: publicMenu.inWork().source,
  //       },
  //       {
  //         parse_mode: 'HTML',
  //         caption: publicMenu.inWork(undefined, request.id).caption,
  //         reply_markup: publicMenu.inWork().markup,
  //       },
  //     );
  //     if (!requestMessage || !request) {
  //       return;
  //     }
  //     const messageToSave: SerializedMessage = {
  //       photoUrl: photoUrl,
  //       text: publicMenu.inWork().caption,
  //       chatId: BigInt(ctx.chat?.id || 0),
  //       messageId: requestMessage.message_id,
  //       requestId: request.id,
  //       accessType: 'PUBLIC',
  //     };
  //     await this.requestService.insertCardRequestMessage(
  //       request.id,
  //       messageToSave,
  //     );
  //     await this.cancel(ctx);
  //   } catch (error) {
  //     console.error('Error parsing IBAN request:', error);

  //     return await this.cancel(ctx);
  //   }
  // }

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
    const deps: UsdStrategyDependencies = {
      ratesService: this.ratesService,
      requestService: this.requestService,
      vendorService: this.vendorService,
    };

    return [
      new UsdCardStrategy({
        ...deps,
        utilsService: this.utilsService,
      }),
      new UsdSkrillEmailStrategy(deps),
      new UsdWireStrategy(deps),
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

  private resolveMethodStep(
    method: PaymentMethodEnum,
  ): 'card' | 'iban' {
    switch (method) {
      case PaymentMethodEnum.CARD:
      case PaymentMethodEnum.PHONE:
      case PaymentMethodEnum.QR:
        return 'card';
      default:
        return 'iban';
    }
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

  private isAwaitingForm(ctx: CustomSceneContext): boolean {
    const state = ctx.session.customState ?? '';
    return state === 'card_request' || state === 'iban_request';
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
      request: FullRequestType;
      details: string;
      originalMessage: { message_id: number; text?: string };
    },
  ) {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      await this.replyEphemeral(
        ctx,
        'Не удалось определить чат. Заявка создана, но уведомления могут не сохраниться.',
      );
      return;
    }

    const request = payload.request;
    const confirmationText = ['✅ Заявка создана.', payload.details]
      .filter(Boolean)
      .join('\n\n');

    const confirmationMessage = await ctx.reply(confirmationText, {
      parse_mode: 'HTML',
    });

    await this.persistMessageSafely(request.id, {
      chatId,
      messageId: confirmationMessage.message_id,
      text: confirmationText,
    });

    if (payload.originalMessage?.message_id && payload.originalMessage?.text) {
      await this.persistMessageSafely(request.id, {
        chatId,
        messageId: payload.originalMessage.message_id,
        text: payload.originalMessage.text,
      });
    }

    const photoUrl = './src/assets/0056.jpg';
    const publicMenu = MenuFactory.createPublicMenu(
      request as unknown as FullRequestType,
      photoUrl,
    );

    const menuMessage = await ctx.replyWithPhoto(
      {
        source: publicMenu.inWork().source,
      },
      {
        caption: publicMenu.inWork().caption,
        reply_markup: publicMenu.inWork().markup,
        parse_mode: 'HTML',
      },
    );

    await this.persistMessageSafely(request.id, {
      chatId,
      messageId: menuMessage.message_id,
      text: publicMenu.inWork().caption,
      photoUrl,
    });

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
        accessType: 'PUBLIC',
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

    const name = lines[0] || '';
    const iban = (lines[1] || '').replace(/\s+/g, '').toUpperCase();
    const inn = (lines[2] || '').replace(/\D/g, '');
    const amountStr = (lines[3] || '').replace(',', '.').replace(/[^\d.]/g, '');
    const comment = lines.length > 4 ? lines.slice(4).join('\n').trim() : '';

    const ibanPattern = /^UA\d{27}$/;
    const innPattern = /^\d{8}$|^\d{10}$/;
    const amountPattern = /^\d+([.,]\d{1,2})?$/;

    if (!ibanPattern.test(iban)) {
      throw new Error(
        'Некорректный IBAN. Пример: UAxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      );
    }
    if (!innPattern.test(inn)) {
      throw new Error('ИНН должен содержать 8 или 10 цифр.');
    }
    if (!amountPattern.test(amountStr)) {
      throw new Error('Сумма должна быть числом, например: 1000.00');
    }

    return {
      name,
      iban,
      inn,
      amount: parseFloat(amountStr),
      comment,
    };
  }
}
