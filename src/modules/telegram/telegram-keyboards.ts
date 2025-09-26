import { createReadStream } from 'fs';
import { AccessType, PaymentMethodEnum } from '@prisma/client';
import { Markup } from 'telegraf';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import { FullRequestType, ReplyPhotoMessage } from 'src/types/types';
import { RequestMessageFactory } from './request/request-message.factory';
import {
  BUTTON_CALLBACKS,
  BUTTON_TEXTS,
  MESSAGES,
  createButton,
  createSingleButtonMarkup,
} from './telegram.constants';

type RequestMethodWithDetails = NonNullable<FullRequestType['methods']>[number];

interface IMenu {
  caption: string;
  markup: InlineKeyboardMarkup;
  username?: string;
  request?: FullRequestType;
}

interface IMenuWithMedia extends IMenu {
  url: string;
  source?: Buffer<ArrayBufferLike>;
}

class Menu implements IMenu {
  caption: string;
  markup: InlineKeyboardMarkup;
  username?: string;
  request?: FullRequestType;

  constructor(
    caption: string,
    markup: InlineKeyboardMarkup,
    request?: FullRequestType,
  ) {
    this.caption = caption;
    this.markup = markup;
    this.request = request;
  }
}

class MenuWithMedia extends Menu implements IMenuWithMedia {
  url: string;
  source?: Buffer<ArrayBufferLike>;

  constructor(
    caption: string,
    markup: InlineKeyboardMarkup,
    url: string,
    request?: FullRequestType,
    source?: Buffer<ArrayBufferLike>,
  ) {
    super(caption, markup, request);
    this.url = url;
    
    // Only create read stream for local file paths, not HTTP URLs
    if (source) {
      this.source = source;
    } else if (url.startsWith('http')) {
      this.source = undefined;
    } else {
      // Check if local file exists before creating read stream
      try {
        const fs = require('fs');
        if (fs.existsSync(url)) {
          this.source = createReadStream(url) as any;
        } else {
          console.warn(`Photo file not found: ${url}, using default`);
          this.source = createReadStream('./src/assets/0056.jpg') as any;
        }
      } catch (error) {
        console.warn(`Error checking photo file: ${error}, using default`);
        this.source = createReadStream('./src/assets/0056.jpg') as any;
      }
    }
  }
}

class SelectPaymentMethodMenu extends Menu {
  constructor(username?: string) {
    const caption = MESSAGES.SELECT_PAYMENT_METHOD(username || '');
    const markup: InlineKeyboardMarkup = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          BUTTON_TEXTS.CARD,
          BUTTON_CALLBACKS.CARD_REQUEST,
        ),
        Markup.button.callback(
          BUTTON_TEXTS.IBAN,
          BUTTON_CALLBACKS.IBAN_REQUEST,
        ),
        Markup.button.callback(
          BUTTON_TEXTS.CANCEL,
          BUTTON_CALLBACKS.CANCEL_REQUEST,
        ),
      ],
    ]).reply_markup;
    super(caption, markup);
  }
}

abstract class PaymentMenu extends Menu {
  constructor(caption: string, username?: string) {
    const markup = createSingleButtonMarkup(
      BUTTON_TEXTS.BACK,
      BUTTON_CALLBACKS.RETURN_TO_REQUEST_MENU,
    );
    super(caption, markup);
    this.username = username;
  }
}

class CardPaymentMenu extends PaymentMenu {
  constructor(username?: string) {
    const caption = MESSAGES.CARD_PAYMENT_FORM(username || '');
    super(caption, username);
  }
}

class IbanPaymentMenu extends PaymentMenu {
  constructor(username?: string) {
    const caption = MESSAGES.IBAN_PAYMENT_FORM(username || '');
    super(caption, username);
  }
}

abstract class BaseRequestMenu {
  protected readonly request: FullRequestType;
  protected readonly url: string;
  protected readonly source?: Buffer<ArrayBufferLike>;
  protected readonly isWorkGroup: boolean;
  protected readonly isHubGroup: boolean;
  private readonly defaultPhotoUrl = './src/assets/0056.jpg';

  protected constructor(
    url: string,
    request: FullRequestType,
    source?: Buffer<ArrayBufferLike>,
    isWorkGroup = false,
    isHubGroup = false,
  ) {
    this.request = request;
    this.url = url || this.defaultPhotoUrl;
    this.source = source;
    this.isWorkGroup = isWorkGroup;
    this.isHubGroup = isHubGroup;
  }

  protected abstract getAccessType(): AccessType;

  private resolveMethod(): RequestMethodWithDetails | null {
    if (!this.request.methods || this.request.methods.length === 0) {
      return null;
    }

    const preferredName = this.request.paymentMethod?.nameEn ?? null;
    if (preferredName) {
      const matched = this.request.methods.find(
        (method) => method.method === preferredName,
      );
      if (matched) {
        return matched;
      }
    }

    return this.request.methods[0] ?? null;
  }

  protected buildBasePayload(accessType?: AccessType): ReplyPhotoMessage {
    const currentAccessType = accessType ?? this.getAccessType();
    const method = this.resolveMethod();
    const maskSensitive = this.shouldMask(currentAccessType);
    const payload = method
      ? RequestMessageFactory.create(currentAccessType, this.request, method, {
        maskSensitive,
      })
      : null;

    if (payload) {
      return payload;
    }

    return {
      text: this.buildFallbackCaption(currentAccessType, method),
    };
  }

  private buildFallbackCaption(
    accessType: AccessType,
    method: RequestMethodWithDetails | null,
  ): string {
    const amount = this.request.amount ?? null;
    const currencyLabel =
      this.request.currency?.nameEn ?? this.request.currency?.name ?? '';
    const rateValue =
      typeof this.request.rates?.rate === 'number'
        ? this.request.rates.rate
        : this.request.rate
          ? Number(this.request.rate)
          : null;

    const lines: Array<string | null> = [
      `✉️<b>Заявка номер:</b> <code>${this.request.id}</code>`,
      this.buildMethodLabel(method, currencyLabel),
      typeof amount === 'number'
        ? `💵<b>Сумма:</b> <code>${amount}</code>${currencyLabel ? ` ${currencyLabel}` : ''}`
        : null,
      rateValue ? `💱<b>Курс:</b> <code>${rateValue.toFixed(2)}</code>` : null,
    ];

    lines.push(
      ...this.buildMethodSpecificLines(accessType, method, currencyLabel),
    );

    if (this.request.activeUser?.username && accessType !== 'PUBLIC') {
      lines.push(`👤<b>Принята:</b> @${this.request.activeUser.username}`);
    }

    if (this.request.vendor?.title) {
      lines.push(`🤝<b>Партнер:</b> <i>${this.request.vendor.title}</i>`);
    }

    if (this.request.payedByUser?.username && accessType === 'ADMIN') {
      lines.push(`💸<b>Оплачено:</b> @${this.request.payedByUser.username}`);
    }

    return lines.filter(Boolean).join('\n');
  }

  private buildMethodLabel(
    method: RequestMethodWithDetails | null,
    currencyLabel: string,
  ): string | null {
    const methodName = method?.method ?? this.request.paymentMethod?.nameEn;
    if (!methodName && !currencyLabel) {
      return null;
    }

    const label = [currencyLabel, methodName]
      .filter((part): part is string => Boolean(part && part.length > 0))
      .join(' • ');

    return label ? `🔖<b>Тип:</b> ${label}` : null;
  }

  private buildMethodSpecificLines(
    accessType: AccessType,
    method: RequestMethodWithDetails | null,
    currencyLabel: string,
  ): Array<string | null> {
    if (!method) {
      return [];
    }

    switch (method.method) {
      case PaymentMethodEnum.CARD:
        return this.buildCardLines(accessType, method);
      case PaymentMethodEnum.WIRE:
        return this.buildWireLines(accessType, method);
      case PaymentMethodEnum.IBAN:
        return this.buildIbanLines(accessType, method);
      case PaymentMethodEnum.PHONE:
        return this.buildPhoneLines(accessType, method);
      case PaymentMethodEnum.SKRILL:
        return this.buildSkrillLines(accessType, method, currencyLabel);
      case PaymentMethodEnum.QR:
        return this.buildQrLines(method);
      default:
        return [];
    }
  }

  private buildCardLines(
    accessType: AccessType,
    method: RequestMethodWithDetails,
  ): Array<string | null> {
    const details = method.cardDetails;
    if (!details) {
      return [];
    }

    const cardNumber = details.card
      ? this.maskDigits(details.card, this.shouldMask(accessType))
      : null;

    const lines: Array<string | null> = [
      cardNumber ? `💳<b>Номер карты:</b> <code>${cardNumber}</code>` : null,
      `🏦<b>Банк:</b> <i>${details.bank?.bankName ?? '-'}</i>`,
      details.comment ? `💬<b>Комментарий:</b> ${details.comment}` : null,
    ];

    if (details.blackList?.length) {
      const reason = details.blackList[0]?.reason;
      lines.push(
        reason
          ? `🚫Карта в чёрном списке: ${reason}`
          : '🚫Карта в чёрном списке',
      );
    }

    return lines;
  }

  private buildWireLines(
    accessType: AccessType,
    method: RequestMethodWithDetails,
  ): Array<string | null> {
    const details = method.wireDetails;
    if (!details) {
      return [];
    }

    const account = details.account
      ? this.maskDigits(details.account, this.shouldMask(accessType))
      : null;

    return [
      account ? `🏦<b>Счёт:</b> <code>${account}</code>` : null,
      details.recipient
        ? `👤<b>Получатель:</b> <code>${details.recipient}</code>`
        : null,
      details.bankName ? `🏦<b>Банк:</b> <i>${details.bankName}</i>` : null,
      details.comment ? `💬<b>Комментарий:</b> ${details.comment}` : null,
    ];
  }

  private buildIbanLines(
    accessType: AccessType,
    method: RequestMethodWithDetails,
  ): Array<string | null> {
    const details = method.ibanDetails;
    if (!details) {
      return [];
    }

    const iban = details.iban
      ? this.maskAlphaNumeric(details.iban, this.shouldMask(accessType))
      : null;

    return [
      details.name ? `👤<b>Имя:</b> <code>${details.name}</code>` : null,
      iban ? `🏦<b>IBAN:</b> <code>${iban}</code>` : null,
      details.inn ? `📋<b>ИНН:</b> <code>${details.inn}</code>` : null,
      details.comment ? `💬<b>Комментарий:</b> ${details.comment}` : null,
    ];
  }

  private buildPhoneLines(
    accessType: AccessType,
    method: RequestMethodWithDetails,
  ): Array<string | null> {
    const details = method.phoneDetails;
    if (!details) {
      return [];
    }

    const phone = details.phoneNumber
      ? this.maskDigits(details.phoneNumber, this.shouldMask(accessType))
      : null;

    return [
      phone ? `📱<b>Телефон:</b> <code>${phone}</code>` : null,
      details.holderName
        ? `👤<b>Получатель:</b> <code>${details.holderName}</code>`
        : null,
      details.comment ? `💬<b>Комментарий:</b> ${details.comment}` : null,
    ];
  }

  private buildSkrillLines(
    accessType: AccessType,
    method: RequestMethodWithDetails,
    currencyLabel: string,
  ): Array<string | null> {
    const details = method.skrillDetails;
    if (!details) {
      return [];
    }

    const email = details.email
      ? this.maskEmail(details.email, this.shouldMask(accessType))
      : null;

    return [
      email ? `📧<b>Email:</b> <code>${email}</code>` : null,
      currencyLabel ? `💱<b>Валюта:</b> <code>${currencyLabel}</code>` : null,
      details.comment ? `💬<b>Комментарий:</b> ${details.comment}` : null,
    ];
  }

  private buildQrLines(method: RequestMethodWithDetails): Array<string | null> {
    const details = method.qrDetails;
    if (!details) {
      return [];
    }

    return [
      details.identifier
        ? `💼<b>Идентификатор:</b> <code>${details.identifier}</code>`
        : null,
      details.comment ? `💬<b>Комментарий:</b> ${details.comment}` : null,
    ];
  }

  protected createInWorkMarkup(requestId?: string): InlineKeyboardMarkup {
    const accessType = this.getAccessType();
    switch (accessType) {
      case 'ADMIN':
        return Markup.inlineKeyboard([
          [
            createButton(BUTTON_TEXTS.ADMIN_IN_WORK, BUTTON_CALLBACKS.DUMMY),
            createButton(
              BUTTON_TEXTS.ADMIN_CANCEL_REQUEST,
              BUTTON_CALLBACKS.ADMIN_CANCEL_REQUEST + (requestId ?? ''),
            ),
          ],
        ]).reply_markup;
      case 'WORKER':
        if (requestId) {
          return Markup.inlineKeyboard([
            [
              createButton(
                BUTTON_TEXTS.TAKE_REQUEST,
                BUTTON_CALLBACKS.TAKE_REQUEST + requestId,
              ),
            ],
          ]).reply_markup;
        }
        return createSingleButtonMarkup(
          BUTTON_TEXTS.IN_WORK,
          BUTTON_CALLBACKS.IN_WORK,
        );
      case 'PUBLIC':
      default:
        return createSingleButtonMarkup(
          BUTTON_TEXTS.IN_WORK,
          BUTTON_CALLBACKS.IN_WORK,
        );
    }
  }

  protected createInProcessMarkup(requestId?: string): InlineKeyboardMarkup {
    const baseMarkup = createSingleButtonMarkup(
      BUTTON_TEXTS.IN_WORK,
      BUTTON_CALLBACKS.IN_WORK,
    );

    if (!requestId) {
      return baseMarkup;
    }

    const cancelButton = Markup.button.callback(
      'Отмена',
      'cancel_payment_' + requestId,
    );

    return Markup.inlineKeyboard([
      [
        createButton(
          BUTTON_TEXTS.REQUEST_COMPLIED,
          BUTTON_CALLBACKS.REQUEST_COMPLIED + requestId,
        ),
        cancelButton,
      ],
    ]).reply_markup;
  }

  protected createDoneMarkup(): InlineKeyboardMarkup {
    return createSingleButtonMarkup(BUTTON_TEXTS.DONE, BUTTON_CALLBACKS.DONE);
  }

  protected createCanceledMarkup(requestId?: string): InlineKeyboardMarkup {
    const accessType = this.getAccessType();

    if (accessType === 'WORKER' && requestId) {
      return Markup.inlineKeyboard([
        [
          createButton(
            BUTTON_TEXTS.VALUT_CARD,
            BUTTON_CALLBACKS.VALUT_CARD + requestId,
          ),
        ],
        [
          createButton(
            BUTTON_TEXTS.BACK_TO_TAKE_REQUEST,
            BUTTON_CALLBACKS.BACK_TO_TAKE_REQUEST + requestId,
          ),
        ],
      ]).reply_markup;
    }

    if (accessType === 'ADMIN' && requestId) {
      return Markup.inlineKeyboard([
        [
          createButton(
            BUTTON_TEXTS.REJECTED_BY_ADMIN,
            BUTTON_CALLBACKS.REJECTED_BY_ADMIN,
          ),
        ],
      ]).reply_markup;
    }

    return createSingleButtonMarkup(
      BUTTON_TEXTS.BACK,
      BUTTON_CALLBACKS.RETURN_TO_REQUEST_MENU,
    );
  }

  protected createRejectedMarkup(): InlineKeyboardMarkup {
    return createSingleButtonMarkup(
      BUTTON_TEXTS.REJECTED,
      BUTTON_CALLBACKS.REJECTED,
    );
  }

  private shouldMask(accessType: AccessType): boolean {
    if (accessType === 'WORKER') {
      if (
        !this.isWorkGroup
      ) {
        return true
      } else if (this.isHubGroup) {
        return false
      }else {
        return false
      }
    } else {
      return false
    }
  }

  private maskDigits(value: string, shouldMask: boolean, visibleDigits = 4): string {
    if (!shouldMask) {
      return value;
    }

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

  private maskAlphaNumeric(value: string, shouldMask: boolean): string {
    if (!shouldMask) {
      return value;
    }

    const alphanumeric = value.replace(/[^0-9a-zA-Z]/g, '');
    if (alphanumeric.length === 0) {
      return value;
    }

    const visible = alphanumeric.slice(-4);
    const maskedSequence = '*'.repeat(Math.max(0, alphanumeric.length - 4)) + visible;

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

  private maskEmail(value: string, shouldMask: boolean): string {
    if (!shouldMask) {
      return value;
    }

    const [local, domain] = value.split('@');
    if (!domain) {
      return this.maskAlphaNumeric(value, true);
    }

    const maskedLocal = local.length <= 2
      ? '*'.repeat(local.length)
      : `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}`;

    return `${maskedLocal}@${domain}`;
  }

  protected messageFromRequest(accessType?: AccessType): ReplyPhotoMessage {
    return this.buildBasePayload(accessType);
  }

  inWork(url?: string, requestId?: string): MenuWithMedia {
    const accessType = this.getAccessType();
    const baseMessage = this.messageFromRequest(accessType);

    const markup =
      baseMessage.inline_keyboard ?? this.createInWorkMarkup(requestId);
    const photoUrl = this.url ?? baseMessage.photoUrl ?? url;
    const source = baseMessage.source ?? this.source;

    return new MenuWithMedia(
      baseMessage.text ?? MESSAGES.NO_DATA,
      markup,
      photoUrl,
      this.request,
      source,
    );
  }

  inProcess(url?: string, requestId?: string): Menu {
    const baseMessage = this.messageFromRequest(this.getAccessType());
    const markup = this.createInProcessMarkup(requestId);
    return new Menu(baseMessage.text ?? MESSAGES.NO_DATA, markup, this.request);
  }

  done(url?: string): MenuWithMedia {
    const baseMessage = this.messageFromRequest(this.getAccessType());
    const markup = this.createDoneMarkup();
    const photoUrl = baseMessage.photoUrl ?? url ?? this.url;
    const source = baseMessage.source ?? this.source;

    return new MenuWithMedia(
      baseMessage.text ?? MESSAGES.NO_DATA,
      markup,
      photoUrl,
      this.request,
      source,
    );
  }

  canceled(url?: string, requestId?: string): MenuWithMedia {
    const baseMessage = this.messageFromRequest(this.getAccessType());
    const markup = this.createCanceledMarkup(requestId);
    const photoUrl = baseMessage.photoUrl ?? url ?? this.url;
    const source = baseMessage.source ?? this.source;

    return new MenuWithMedia(
      baseMessage.text ?? MESSAGES.NO_DATA,
      markup,
      photoUrl,
      this.request,
      source,
    );
  }

  rejected(url?: string): MenuWithMedia {
    const baseMessage = this.messageFromRequest(this.getAccessType());
    const markup = this.createRejectedMarkup();
    const photoUrl = baseMessage.photoUrl ?? url ?? this.url;
    const source = baseMessage.source ?? this.source;

    return new MenuWithMedia(
      baseMessage.text ?? MESSAGES.NO_DATA,
      markup,
      photoUrl,
      this.request,
      source,
    );
  }
}

class PublicMenu extends BaseRequestMenu {
  constructor(
    url: string,
    request: FullRequestType,
    source?: Buffer<ArrayBufferLike>,
  ) {
    super(url, request, source);
  }

  protected getAccessType(): AccessType {
    return 'PUBLIC';
  }
}

class WorkMenu extends BaseRequestMenu {
  constructor(
    url: string,
    request: FullRequestType,
    source?: Buffer<ArrayBufferLike>,
    isWorkGroup = false,
    isHubGroup = false,
  ) {
    super(url, request, source, isWorkGroup, isHubGroup);
  }

  protected getAccessType(): AccessType {
    return 'WORKER';
  }
}

class AdminMenu extends BaseRequestMenu {
  constructor(
    url: string,
    request: FullRequestType,
    source?: Buffer<ArrayBufferLike>,
  ) {
    super(url, request, source);
  }

  protected getAccessType(): AccessType {
    return 'ADMIN';
  }
}

export class MenuFactory {
  static createMenu(caption: string, markup: InlineKeyboardMarkup): Menu {
    return new Menu(caption, markup);
  }

  static createWorkerMenu(
    request: FullRequestType,
    url: string,
    source?: Buffer<ArrayBufferLike>,
    isWorkGroup = false,
    isHubGroup = false,
  ): WorkMenu {
    return new WorkMenu(url, request, source, isWorkGroup, isHubGroup);
  }

  static createAdminMenu(
    request: FullRequestType,
    url: string,
    source?: Buffer<ArrayBufferLike>,
  ): AdminMenu {
    return new AdminMenu(url, request, source);
  }

  static createPublicMenu(
    request: FullRequestType,
    url: string,
    source?: Buffer<ArrayBufferLike>,
  ): PublicMenu {
    return new PublicMenu(url, request, source);
  }

  static createSelectPaymentMethodMenu(
    username: string,
  ): SelectPaymentMethodMenu {
    return new SelectPaymentMethodMenu(username);
  }

  static createCardPaymentMenu(username?: string): CardPaymentMenu {
    return new CardPaymentMenu(username);
  }

  static createIbanPaymentMenu(username?: string): IbanPaymentMenu {
    return new IbanPaymentMenu(username);
  }

  static createMenuWithMedia(
    caption: string,
    markup: InlineKeyboardMarkup,
    media: string,
  ): MenuWithMedia {
    return new MenuWithMedia(caption, markup, media);
  }
}

export {
  BUTTON_CALLBACKS,
  BUTTON_TEXTS,
  MESSAGES,
  createButton,
  createSingleButtonMarkup,
};
