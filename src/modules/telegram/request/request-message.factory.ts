import { Markup } from 'telegraf';
import { AccessType, CurrencyEnum, PaymentMethodEnum } from '@prisma/client';
import { FullRequestType, ReplyPhotoMessage } from 'src/types/types';
import { BUTTON_CALLBACKS, BUTTON_TEXTS } from '../telegram.constants';

type RequestMethodWithDetails = NonNullable<FullRequestType['methods']>[number];

type RequestMessageFactoryOptions = {
  maskSensitive?: boolean;
};

export class RequestMessageFactory {
  static create(
    accessType: AccessType,
    request: FullRequestType,
    method: RequestMethodWithDetails,
    options: RequestMessageFactoryOptions = {},
  ): ReplyPhotoMessage | null {
    if (request.currency?.name !== CurrencyEnum.USD) {
      return null;
    }

    switch (method.method) {
      case PaymentMethodEnum.CARD:
        return this.createUsdCardMessage(accessType, request, method, options);
      case PaymentMethodEnum.WIRE:
        return this.createUsdWireMessage(accessType, request, method, options);
      default:
        return null;
    }
  }

  private static createUsdCardMessage(
    accessType: AccessType,
    request: FullRequestType,
    method: RequestMethodWithDetails,
    options: RequestMessageFactoryOptions,
  ): ReplyPhotoMessage | null {
    switch (accessType) {
      case 'WORKER':
        return this.createUsdCardWorkerMessage(request, method, options);
      case 'ADMIN':
        return this.createUsdCardAdminMessage(request, method);
      case 'PUBLIC':
        return this.createUsdCardPublicMessage(request, method);
      default:
        return null;
    }
  }

  private static createUsdCardWorkerMessage(
    request: FullRequestType,
    method: RequestMethodWithDetails,
    options: RequestMessageFactoryOptions,
  ): ReplyPhotoMessage | null {
    const cardDetails = method.cardDetails;
    if (!cardDetails) {
      return null;
    }

    const amount = request.amount ?? 0;
    const rateValue =
      typeof request.rates?.rate === 'number'
        ? request.rates.rate
        : request.rate
          ? Number(request.rate)
          : null;
    const maskedCard = cardDetails.card
      ? options.maskSensitive
        ? this.maskDigits(cardDetails.card)
        : cardDetails.card
      : null;
    const lines: Array<string | null> = [
      `✉️<b>Заявка номер:</b> <code>${request.id}</code>`,
      `🔖<b>Тип:</b> USD CARD`,
      `💵<b>Сумма:</b> <code>${amount}</code> ${request.currency?.nameEn ?? ''}`,
      rateValue ? `💱<b>Курс:</b> <code>${rateValue.toFixed(2)}</code>` : null,
      maskedCard ? `💳<b>Номер карты:</b> <code>${maskedCard}</code>` : null,
      `🏦<b>Банк:</b> <i>${cardDetails.bank?.bankName ?? '-'}</i>`,
      request.vendor?.title
        ? `🤝<b>Партнер:</b> <i>${request.vendor.title}</i>`
        : null,
    ];

    if (cardDetails.blackList?.length) {
      const reason = cardDetails.blackList[0]?.reason;
      lines.push(
        reason
          ? `🚫Карта в чёрном списке: ${reason}`
          : '🚫Карта в чёрном списке',
      );
    }

    const caption = lines.filter(Boolean).join('\n');

    const inline_keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          BUTTON_TEXTS.TAKE_REQUEST,
          BUTTON_CALLBACKS.TAKE_REQUEST + request.id,
        ),
      ],
    ]).reply_markup;

    return {
      text: caption,
      inline_keyboard,
    };
  }

  private static createUsdCardAdminMessage(
    request: FullRequestType,
    method: RequestMethodWithDetails,
  ): ReplyPhotoMessage | null {
    const cardDetails = method.cardDetails;
    if (!cardDetails) {
      return null;
    }

    const amount = request.amount ?? 0;
    const rateValue =
      typeof request.rates?.rate === 'number'
        ? request.rates.rate
        : request.rate
          ? Number(request.rate)
          : null;
    const lines: Array<string | null> = [
      `✉️<b>Заявка номер:</b> <code>${request.id}</code>`,
      `🔖<b>Тип:</b> USD CARD`,
      `💵<b>Сумма:</b> <code>${amount}</code> ${request.currency?.nameEn ?? ''}`,
      rateValue ? `💱<b>Курс:</b> <code>${rateValue.toFixed(2)}</code>` : null,
      `💳<b>Номер карты:</b> <code>${cardDetails.card}</code>`,
      `🏦<b>Банк:</b> <i>${cardDetails.bank?.bankName ?? '-'}</i>`,
      request.activeUser?.username
        ? `👤<b>Принята:</b> @${request.activeUser.username}`
        : null,
      request.vendor?.title
        ? `🤝<b>Партнер:</b> <i>${request.vendor.title}</i>`
        : null,
    ];

    if (cardDetails.blackList?.length) {
      const reason = cardDetails.blackList[0]?.reason;
      lines.push(
        reason
          ? `🚫Карта в чёрном списке: ${reason}`
          : '🚫Карта в чёрном списке',
      );
    }

    const caption = lines.filter(Boolean).join('\n');

    const inline_keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          BUTTON_TEXTS.ADMIN_IN_WORK,
          BUTTON_CALLBACKS.DUMMY,
        ),
        Markup.button.callback(
          BUTTON_TEXTS.ADMIN_CANCEL_REQUEST,
          BUTTON_CALLBACKS.ADMIN_CANCEL_REQUEST + request.id,
        ),
      ],
    ]).reply_markup;

    return {
      text: caption,
      inline_keyboard,
    };
  }

  private static createUsdCardPublicMessage(
    request: FullRequestType,
    method: RequestMethodWithDetails,
  ): ReplyPhotoMessage | null {
    const cardDetails = method.cardDetails;
    if (!cardDetails) {
      return null;
    }

    const amount = request.amount ?? 0;
    const rateValue =
      typeof request.rates?.rate === 'number'
        ? request.rates.rate
        : request.rate
          ? Number(request.rate)
          : null;
    const lines: Array<string | null> = [
      `✉️<b>Заявка номер:</b> <code>${request.id}</code>`,
      `🔖<b>Тип:</b> USD CARD`,
      `💵<b>Сумма:</b> <code>${amount}</code> ${request.currency?.nameEn ?? ''}`,
      rateValue ? `💱<b>Курс:</b> <code>${rateValue.toFixed(2)}</code>` : null,
      `💳<b>Номер карты:</b> <code>${cardDetails.card}</code>`,
      `🏦<b>Банк:</b> <i>${cardDetails.bank?.bankName ?? '-'}</i>`,
      request.vendor?.title
        ? `🤝<b>Партнер:</b> <i>${request.vendor.title}</i>`
        : null,
    ];

    const caption = lines.filter(Boolean).join('\n');

    const inline_keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          BUTTON_TEXTS.IN_WORK,
          BUTTON_CALLBACKS.IN_WORK,
        ),
      ],
    ]).reply_markup;

    return {
      text: caption,
      inline_keyboard,
    };
  }

  private static createUsdWireMessage(
    accessType: AccessType,
    request: FullRequestType,
    method: RequestMethodWithDetails,
    options: RequestMessageFactoryOptions,
  ): ReplyPhotoMessage | null {
    switch (accessType) {
      case 'WORKER':
        return this.createUsdWireWorkerMessage(request, method, options);
      case 'ADMIN':
        return this.createUsdWireAdminMessage(request, method);
      case 'PUBLIC':
        return this.createUsdWirePublicMessage(request, method);
      default:
        return null;
    }
  }

  private static createUsdWireWorkerMessage(
    request: FullRequestType,
    method: RequestMethodWithDetails,
    options: RequestMessageFactoryOptions,
  ): ReplyPhotoMessage | null {
    const wireDetails = method.wireDetails;
    if (!wireDetails) {
      return null;
    }

    const amount = request.amount ?? 0;
    const rateValue =
      typeof request.rates?.rate === 'number'
        ? request.rates.rate
        : request.rate
          ? Number(request.rate)
          : null;
    const usdt = rateValue && rateValue !== 0 ? (amount / rateValue).toFixed(2) : null;
    const maskedAccount = wireDetails.account
      ? options.maskSensitive
        ? this.maskDigits(wireDetails.account)
        : wireDetails.account
      : null;

    const lines: Array<string | null> = [
      `✉️<b>Заявка номер:</b> <code>${request.id}</code>`,
      `🔖<b>Тип:</b> USD WIRE`,
      `💵<b>Сумма:</b> <code>${amount}</code> ${request.currency?.nameEn ?? ''}`,
      rateValue ? `💱<b>Курс:</b> <code>${rateValue.toFixed(2)}</code>` : null,
      usdt ? `💎<b>USDT:</b> <code>${usdt}</code>` : null,
      maskedAccount ? `🏦<b>Счёт:</b> <code>${maskedAccount}</code>` : null,
      `👤<b>Получатель:</b> <code>${wireDetails.recipient}</code>`,
      wireDetails.bankName ? `🏦<b>Банк:</b> <i>${wireDetails.bankName}</i>` : null,
      request.vendor?.title
        ? `🤝<b>Партнер:</b> <i>${request.vendor.title}</i>`
        : null,
      wireDetails.comment ? `💬<b>Комментарий:</b> ${wireDetails.comment}` : null,
    ];

    const caption = lines.filter(Boolean).join('\n');

    const inline_keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          BUTTON_TEXTS.TAKE_REQUEST,
          BUTTON_CALLBACKS.TAKE_REQUEST + request.id,
        ),
      ],
    ]).reply_markup;

    return {
      text: caption,
      inline_keyboard,
    };
  }

  private static createUsdWireAdminMessage(
    request: FullRequestType,
    method: RequestMethodWithDetails,
  ): ReplyPhotoMessage | null {
    const wireDetails = method.wireDetails;
    if (!wireDetails) {
      return null;
    }

    const amount = request.amount ?? 0;
    const rateValue =
      typeof request.rates?.rate === 'number'
        ? request.rates.rate
        : request.rate
          ? Number(request.rate)
          : null;
    const usdt = rateValue && rateValue !== 0 ? (amount / rateValue).toFixed(2) : null;

    const lines: Array<string | null> = [
      `✉️<b>Заявка номер:</b> <code>${request.id}</code>`,
      `🔖<b>Тип:</b> USD WIRE`,
      `💵<b>Сумма:</b> <code>${amount}</code> ${request.currency?.nameEn ?? ''}`,
      rateValue ? `💱<b>Курс:</b> <code>${rateValue.toFixed(2)}</code>` : null,
      usdt ? `💎<b>USDT:</b> <code>${usdt}</code>` : null,
      `🏦<b>Счёт:</b> <code>${wireDetails.account}</code>`,
      `👤<b>Получатель:</b> <code>${wireDetails.recipient}</code>`,
      wireDetails.bankName ? `🏦<b>Банк:</b> <i>${wireDetails.bankName}</i>` : null,
      wireDetails.comment ? `💬<b>Комментарий:</b> ${wireDetails.comment}` : null,
      request.vendor?.title
        ? `🤝<b>Партнер:</b> <i>${request.vendor.title}</i>`
        : null,
    ];

    const caption = lines.filter(Boolean).join('\n');

    const inline_keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          BUTTON_TEXTS.ADMIN_IN_WORK,
          BUTTON_CALLBACKS.DUMMY,
        ),
        Markup.button.callback(
          BUTTON_TEXTS.ADMIN_CANCEL_REQUEST,
          BUTTON_CALLBACKS.ADMIN_CANCEL_REQUEST + request.id,
        ),
      ],
    ]).reply_markup;

    return {
      text: caption,
      inline_keyboard,
    };
  }

  private static createUsdWirePublicMessage(
    request: FullRequestType,
    method: RequestMethodWithDetails,
  ): ReplyPhotoMessage | null {
    const wireDetails = method.wireDetails;
    if (!wireDetails) {
      return null;
    }

    const amount = request.amount ?? 0;
    const rateValue =
      typeof request.rates?.rate === 'number'
        ? request.rates.rate
        : request.rate
          ? Number(request.rate)
          : null;
    const usdt = rateValue && rateValue !== 0 ? (amount / rateValue).toFixed(2) : null;

    const lines: Array<string | null> = [
      `✉️<b>Заявка номер:</b> <code>${request.id}</code>`,
      `🔖<b>Тип:</b> USD WIRE`,
      `💵<b>Сумма:</b> <code>${amount}</code> ${request.currency?.nameEn ?? ''}`,
      rateValue ? `💱<b>Курс:</b> <code>${rateValue.toFixed(2)}</code>` : null,
      usdt ? `💎<b>USDT:</b> <code>${usdt}</code>` : null,
      `🏦<b>Счёт:</b> <code>${wireDetails.account}</code>`,
      `👤<b>Получатель:</b> <code>${wireDetails.recipient}</code>`,
      wireDetails.bankName ? `🏦<b>Банк:</b> <i>${wireDetails.bankName}</i>` : null,
      wireDetails.comment ? `💬<b>Комментарий:</b> ${wireDetails.comment}` : null,
      request.vendor?.title
        ? `🤝<b>Партнер:</b> <i>${request.vendor.title}</i>`
        : null,
    ];

    const caption = lines.filter(Boolean).join('\n');

    const inline_keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          BUTTON_TEXTS.IN_WORK,
          BUTTON_CALLBACKS.IN_WORK,
        ),
      ],
    ]).reply_markup;

    return {
      text: caption,
      inline_keyboard,
    };
  }

  private static maskDigits(value: string, visibleDigits = 4): string {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) {
      return value;
    }
    const safeVisible = Math.max(0, Math.min(visibleDigits, digits.length));
    const maskedDigits =
      '*'.repeat(Math.max(0, digits.length - safeVisible)) + digits.slice(-safeVisible);

    let maskedValue = '';
    let index = 0;
    for (const char of value) {
      if (/\d/.test(char)) {
        maskedValue += maskedDigits[index] ?? '*';
        index += 1;
      } else {
        maskedValue += char;
      }
    }

    return maskedValue;
  }
}
