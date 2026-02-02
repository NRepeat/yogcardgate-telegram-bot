import { Markup } from 'telegraf';
import { AccessType, PaymentMethodEnum } from '@prisma/client';
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
    switch (method.method) {
      case PaymentMethodEnum.CARD:
      case PaymentMethodEnum.KZT_KASPI_BANK:
      case PaymentMethodEnum.KZT_OTHER_BANKS:
      case PaymentMethodEnum.CNY_CARD:
        return this.buildCardMessage(accessType, request, method, options);
      case PaymentMethodEnum.WISE:
        return this.buildWiseMessage(accessType, request, method, options);
      case PaymentMethodEnum.PAYPAL:
        return this.buildPayPalMessage(accessType, request, method, options);
      case PaymentMethodEnum.CNY_ACCOUNT:
      case PaymentMethodEnum.BANK:
        return this.buildBankMessage(accessType, request, method, options);
      case PaymentMethodEnum.IBAN:
        return this.buildIbanMessage(accessType, request, method, options);
      case PaymentMethodEnum.SKRILL:
        return this.buildSkrillMessage(accessType, request, method, options);
      case PaymentMethodEnum.PAYONEER:
        return this.buildPayoneerMessage(accessType, request, method, options);
      case PaymentMethodEnum.PHONE:
        return this.buildPhoneMessage(accessType, request, method, options);
      case PaymentMethodEnum.QR:
      case PaymentMethodEnum.CNY_ALIPAY:
      case PaymentMethodEnum.CNY_WECHAT:
        return this.buildQrMessage(accessType, request, method);
      default:
        return this.buildGenericMessage(accessType, request, method);
    }
  }

  private static buildCardMessage(
    accessType: AccessType,
    request: FullRequestType,
    method: RequestMethodWithDetails,
    options: RequestMessageFactoryOptions,
  ): ReplyPhotoMessage | null {
    const details = method.cardDetails;
    if (!details) {
      return null;
    }

    const cardNumber = details.card
      ? options.maskSensitive
        ? this.maskDigits(details.card)
        : details.card
      : null;

    const lines = this.composeBaseLines(request, method.method, [
      cardNumber ? `💳<b>Номер карты:</b> <code>${cardNumber}</code>` : null,
      details.holder ? `👤<b>ФИО:</b> ${details.holder}` : null,
      details.bank?.bankName
        ? `🏦<b>Банк:</b> <i>${details.bank.bankName}</i>`
        : null,
      this.partnerLine(request),
    ]);

    if (details.blackList?.length) {
      const reason = details.blackList[0]?.reason;
      lines.push(
        reason
          ? `🚫Карта в чёрном списке: ${reason}`
          : '🚫Карта в чёрном списке',
      );
    }

    return this.wrapWithButtons(accessType, request.id, lines);
  }

  private static buildWiseMessage(
    accessType: AccessType,
    request: FullRequestType,
    method: RequestMethodWithDetails,
    options: RequestMessageFactoryOptions,
  ): ReplyPhotoMessage | null {
    const details = method.wiseDetails;
    if (!details) {
      return null;
    }

    const email = details.email
      ? options.maskSensitive
        ? this.maskEmail(details.email, true)
        : details.email
      : null;

    const lines = this.composeBaseLines(request, method.method, [
      email ? `📧<b>Email:</b> <code>${email}</code>` : null,
      details.fullName
        ? `👤<b>ФИО:</b> <code>${details.fullName}</code>`
        : null,
      details.cardNumber
        ? `💳<b>Карта Wise:</b> <code>${details.cardNumber}</code>`
        : null,
      details.comment ? `💬<b>Комментарий:</b> ${details.comment}` : null,
      this.partnerLine(request),
    ]);

    return this.wrapWithButtons(accessType, request.id, lines);
  }

  private static buildPayPalMessage(
    accessType: AccessType,
    request: FullRequestType,
    method: RequestMethodWithDetails,
    options: RequestMessageFactoryOptions,
  ): ReplyPhotoMessage | null {
    const details = method.paypalDetails;
    if (!details) {
      return null;
    }

    const email = details.email
      ? options.maskSensitive
        ? this.maskEmail(details.email, true)
        : details.email
      : null;

    const lines = this.composeBaseLines(request, method.method, [
      email ? `📧<b>Email:</b> <code>${email}</code>` : null,
      details.fullName
        ? `👤<b>ФИО:</b> <code>${details.fullName}</code>`
        : null,
      details.comment ? `💬<b>Комментарий:</b> ${details.comment}` : null,
      this.partnerLine(request),
    ]);

    return this.wrapWithButtons(accessType, request.id, lines);
  }

  private static buildBankMessage(
    accessType: AccessType,
    request: FullRequestType,
    method: RequestMethodWithDetails,
    options: RequestMessageFactoryOptions,
  ): ReplyPhotoMessage | null {
    const details = method.bankDetails;
    if (!details) {
      return null;
    }

    const account = details.account
      ? options.maskSensitive
        ? this.maskDigits(details.account)
        : details.account
      : null;

    const lines = this.composeBaseLines(request, method.method, [
      account ? `🏦<b>Счёт:</b> <code>${account}</code>` : null,
      details.recipient
        ? `👤<b>Получатель:</b> <code>${details.recipient}</code>`
        : null,
      details.bankName ? `🏦<b>Банк:</b> <i>${details.bankName}</i>` : null,
      details.comment ? `💬<b>Комментарий:</b> ${details.comment}` : null,
      this.partnerLine(request),
    ]);

    return this.wrapWithButtons(accessType, request.id, lines);
  }

  private static buildIbanMessage(
    accessType: AccessType,
    request: FullRequestType,
    method: RequestMethodWithDetails,
    options: RequestMessageFactoryOptions,
  ): ReplyPhotoMessage | null {
    const details = method.ibanDetails;
    if (!details) {
      return null;
    }

    const iban = details.iban
      ? options.maskSensitive
        ? this.maskAlphaNumeric(details.iban)
        : details.iban
      : null;

    const lines = this.composeBaseLines(request, method.method, [
      details.name ? `👤<b>Получатель:</b> <code>${details.name}</code>` : null,
      iban ? `🏦<b>IBAN:</b> <code>${iban}</code>` : null,
      details.inn ? `📋<b>ИНН:</b> <code>${details.inn}</code>` : null,
      this.partnerLine(request),
    ]);

    return this.wrapWithButtons(accessType, request.id, lines);
  }

  private static buildSkrillMessage(
    accessType: AccessType,
    request: FullRequestType,
    method: RequestMethodWithDetails,
    options: RequestMessageFactoryOptions,
  ): ReplyPhotoMessage | null {
    const details = method.skrillDetails;
    if (!details) {
      return null;
    }

    const email = details.email
      ? options.maskSensitive
        ? this.maskEmail(details.email, true)
        : details.email
      : null;

    const lines = this.composeBaseLines(request, method.method, [
      email ? `📧<b>Email:</b> <code>${email}</code>` : null,
      details.comment ? `💬<b>Комментарий:</b> ${details.comment}` : null,
      this.partnerLine(request),
    ]);

    return this.wrapWithButtons(accessType, request.id, lines);
  }

  private static buildPayoneerMessage(
    accessType: AccessType,
    request: FullRequestType,
    method: RequestMethodWithDetails,
    options: RequestMessageFactoryOptions,
  ): ReplyPhotoMessage | null {
    const details = method.payoneerDetails;
    if (!details) {
      return null;
    }

    const email = details.email
      ? options.maskSensitive
        ? this.maskEmail(details.email, true)
        : details.email
      : null;

    const lines = this.composeBaseLines(request, method.method, [
      email ? `📧<b>Email:</b> <code>${email}</code>` : null,
      details.comment ? `💬<b>Комментарий:</b> ${details.comment}` : null,
      this.partnerLine(request),
    ]);

    return this.wrapWithButtons(accessType, request.id, lines);
  }

  private static buildPhoneMessage(
    accessType: AccessType,
    request: FullRequestType,
    method: RequestMethodWithDetails,
    options: RequestMessageFactoryOptions,
  ): ReplyPhotoMessage | null {
    const details = method.phoneDetails;
    if (!details) {
      return null;
    }

    const phone = details.phoneNumber
      ? options.maskSensitive
        ? this.maskDigits(details.phoneNumber)
        : details.phoneNumber
      : null;

    const lines = this.composeBaseLines(request, method.method, [
      phone ? `📱<b>Телефон:</b> <code>${phone}</code>` : null,
      details.holderName
        ? `👤<b>Получатель:</b> <code>${details.holderName}</code>`
        : null,
      details.comment ? `💬<b>Комментарий:</b> ${details.comment}` : null,
      this.partnerLine(request),
    ]);

    return this.wrapWithButtons(accessType, request.id, lines);
  }

  private static buildQrMessage(
    accessType: AccessType,
    request: FullRequestType,
    method: RequestMethodWithDetails,
  ): ReplyPhotoMessage | null {
    const details = method.qrDetails;
    if (!details) {
      return null;
    }

    const lines = this.composeBaseLines(request, method.method, [
      details.identifier
        ? `💼<b>Идентификатор:</b> <code>${details.identifier}</code>`
        : null,
      details.comment ? `👤<b>ФИО латиницей:</b> ${details.comment}` : null,
      this.partnerLine(request),
    ]);

    return this.wrapWithButtons(accessType, request.id, lines);
  }

  private static buildGenericMessage(
    accessType: AccessType,
    request: FullRequestType,
    method: RequestMethodWithDetails,
  ): ReplyPhotoMessage {
    const lines = this.composeBaseLines(request, method.method, [
      this.partnerLine(request),
    ]);

    return this.wrapWithButtons(accessType, request.id, lines);
  }

  private static composeBaseLines(
    request: FullRequestType,
    method: PaymentMethodEnum,
    extraLines: Array<string | null>,
  ): string[] {
    const rateLine = this.formatRateLine(request);
    const amountLine = this.formatAmountLine(request);
    const methodDisplayName = this.getMethodDisplayName(method);
    const methodLabel =
      `${request.currency?.nameEn ?? request.currency?.name ?? ''} ${methodDisplayName}`.trim();

    const lines: Array<string | null> = [
      `✉️<b>Заявка номер:</b> <code>${request.id}</code>`,
      `🔖<b>Валюта:</b> ${methodLabel}`,
      amountLine,
      rateLine,
      ...extraLines,
    ];

    if (request.activeUser?.username) {
      lines.push(`👤<b>Принята:</b> @${request.activeUser.username}`);
    }

    return lines.filter((line): line is string => Boolean(line));
  }

  private static wrapWithButtons(
    accessType: AccessType,
    requestId: string,
    lines: string[],
  ): ReplyPhotoMessage {
    const sanitizedLines =
      accessType === 'PUBLIC'
        ? lines.filter((line) => !line.startsWith('👤<b>Принята:'))
        : lines;
    const caption = sanitizedLines.join('\n');

    let inline_keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(BUTTON_TEXTS.IN_WORK, BUTTON_CALLBACKS.IN_WORK)],
    ]).reply_markup;

    if (accessType === 'WORKER') {
      inline_keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            BUTTON_TEXTS.TAKE_REQUEST,
            BUTTON_CALLBACKS.TAKE_REQUEST + requestId,
          ),
        ],
      ]).reply_markup;
    } else if (accessType === 'ADMIN') {
      inline_keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            BUTTON_TEXTS.ADMIN_IN_WORK,
            BUTTON_CALLBACKS.DUMMY,
          ),
          Markup.button.callback(
            BUTTON_TEXTS.ADMIN_CANCEL_REQUEST,
            BUTTON_CALLBACKS.ADMIN_CANCEL_REQUEST + requestId,
          ),
        ],
      ]).reply_markup;
    }

    return {
      text: caption,
      inline_keyboard,
    };
  }

  private static formatAmountLine(request: FullRequestType): string | null {
    if (typeof request.amount !== 'number') {
      return null;
    }

    const currency = request.currency?.nameEn ?? request.currency?.name ?? '';
    return `💵<b>Сумма:</b> <code>${request.amount}</code>${
      currency ? ` ${currency}` : ''
    }`;
  }

  private static formatRateLine(request: FullRequestType): string | null {
    const rateValue =
      request.rate
        ? Number(request.rate)
        : typeof request.rates?.rate === 'number'
          ? request.rates.rate
          : null;

    if (!rateValue || Number.isNaN(rateValue)) {
      return null;
    }

    // Use 3 decimal places for USD/EUR/GBP, 2 for others
    const currencyCode = request.currency?.nameEn?.toUpperCase();
    const decimals = ['USD', 'EUR', 'GBP'].includes(currencyCode || '') ? 3 : 2;

    return `💱<b>Курс:</b> <code>${rateValue.toFixed(decimals)}</code>`;
  }

  private static partnerLine(request: FullRequestType): string | null {
    return request.vendor?.title
      ? `🤝<b>Партнер:</b> <i>${request.vendor.title}</i>`
      : null;
  }

  private static maskDigits(value: string, visibleDigits = 4): string {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) {
      return value;
    }

    const safeVisible = Math.max(0, Math.min(visibleDigits, digits.length));
    const maskedDigits =
      '*'.repeat(Math.max(0, digits.length - safeVisible)) +
      digits.slice(-safeVisible);

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

  private static maskAlphaNumeric(value: string): string {
    const alphanumeric = value.replace(/[^0-9a-zA-Z]/g, '');
    if (alphanumeric.length === 0) {
      return value;
    }

    const visible = alphanumeric.slice(-4);
    const maskedSequence =
      '*'.repeat(Math.max(0, alphanumeric.length - 4)) + visible;

    let masked = '';
    let idx = 0;
    for (const char of value) {
      if (/[0-9a-zA-Z]/.test(char)) {
        masked += maskedSequence[idx] ?? '*';
        idx += 1;
      } else {
        masked += char;
      }
    }

    return masked;
  }

  private static maskEmail(value: string, shouldMask: boolean): string {
    if (!shouldMask) {
      return value;
    }

    const [local, domain] = value.split('@');
    if (!domain) {
      return this.maskAlphaNumeric(value);
    }

    if (local.length <= 2) {
      return `${'*'.repeat(local.length)}@${domain}`;
    }

    return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
  }

  private static getMethodDisplayName(method: PaymentMethodEnum): string {
    const methodDisplayMap: Record<PaymentMethodEnum, string> = {
      [PaymentMethodEnum.KZT_KASPI_BANK]: 'Kaspi Bank',
      [PaymentMethodEnum.KZT_OTHER_BANKS]: 'Остальные банки',
      [PaymentMethodEnum.CNY_ALIPAY]: 'Alipay',
      [PaymentMethodEnum.CNY_WECHAT]: 'WeChat Pay',
      [PaymentMethodEnum.CNY_CARD]: 'карта',
      [PaymentMethodEnum.CNY_ACCOUNT]: 'номер счета',
      [PaymentMethodEnum.CARD]: 'карта',
      [PaymentMethodEnum.IBAN]: 'IBAN',
      [PaymentMethodEnum.PHONE]: 'телефон',
      [PaymentMethodEnum.WISE]: 'Wise',
      [PaymentMethodEnum.SKRILL]: 'Skrill',
      [PaymentMethodEnum.QR]: 'QR-код',
      [PaymentMethodEnum.BANK]: 'Банковская оплата',
      [PaymentMethodEnum.PAYONEER]: 'PAYONEER',
      [PaymentMethodEnum.PAYPAL]: 'PayPal',
    };

    return methodDisplayMap[method] || method;
  }
}
