import { createReadStream, ReadStream } from 'fs';
import { AccessType } from '@prisma/client';
import { FullRequestType } from 'src/types/types';
import { Markup } from 'telegraf';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';

interface IMenu {
  caption: string;
  markup: InlineKeyboardMarkup;
  username?: string;
  request?: FullRequestType;
}

interface IMenuWithMedia extends IMenu {
  url: string;
  source?: Buffer<ArrayBufferLike> | ReadStream;
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
  source: Buffer<ArrayBufferLike>;
  constructor(
    caption: string,
    markup: InlineKeyboardMarkup,
    url: string,
    request?: FullRequestType,
    source?: Buffer<ArrayBufferLike>,
  ) {
    super(caption, markup, request);
    this.url = url;
    this.source = source
      ? source
      : (createReadStream(url) as any as Buffer<ArrayBufferLike>);
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
  request: FullRequestType;
  url: string;
  source: Buffer<ArrayBufferLike>;
  isWorkGroup?: boolean;
  isHubGroup?: boolean;
  constructor(
    url: string,
    request: FullRequestType,
    source?: Buffer<ArrayBufferLike>,
    isWorkGroup?: boolean,
    isHubGroup?: boolean,
  ) {
    const photoUrl = './src/assets/0056.jpg';
    this.request = request;
    this.url = url ? url : photoUrl;
    this.source = source || Buffer.from([]);
    this.isWorkGroup = isWorkGroup || false;
    this.isHubGroup = isHubGroup || false;
  }

  protected abstract getAccessType(): AccessType;

  messageFromRequest(accessType?: AccessType): string {
    if (!this.request) {
      return MESSAGES.NO_DATA;
    }
    console.log(
      'Generating message for request:',
      this.isWorkGroup,
      this.isHubGroup,
    );
    const currentAccessType = accessType || this.getAccessType();
    const paymentMethod = this.request.paymentMethod?.nameEn;

    if (paymentMethod === 'CARD') {
      return this.buildCardRequestMessage(currentAccessType);
    }

    if (paymentMethod === 'IBAN') {
      return this.buildIbanRequestMessage(currentAccessType);
    }

    return this.buildUnknownPaymentMessage();
  }

  private buildCardRequestMessage(accessType: AccessType): string {
    const cardMethod = this.request.cardMethods?.[0];
    const amount = this.request.amount ?? 0;
    const rateValue = this.request.rates?.rate;
    const rateLines = this.buildRateLines(rateValue, amount);
    const cardLine = this.buildCardNumberLine(cardMethod?.card, accessType);
    const lines: Array<string | null> = [
      this.buildHeaderLine(),
      `🏦<b>Банк:</b> <i>${cardMethod?.bank?.bankName ?? '-'}</i>`,
      `💵<b>Сумма:</b> <code>${amount}</code>`,
      ...rateLines,
      cardLine,
    ];

    if ((accessType === 'ADMIN' || accessType === 'WORKER') && this.request.activeUser?.username) {
      lines.push(`<b>Пользователь:</b> @${this.request.activeUser.username}`);
    }

    if (accessType === 'ADMIN') {
      if (this.request.payedByUser?.username) {
        lines.push(`<b>Оплачено:</b> @${this.request.payedByUser.username}`);
      }
      lines.push(`<b>Партнер:</b> <i>${this.request.vendor?.title ?? '-'}</i>`);
    }

    if ((accessType === 'ADMIN' || accessType === 'WORKER') && cardMethod?.blackList?.length) {
      lines.push('🚫Карта в чёрном списке');
    }

    return this.joinMessageLines(lines);
  }

  private buildIbanRequestMessage(accessType: AccessType): string {
    const ibanMethod = this.request.ibanMethods?.[0];
    const amount = this.request.amount ?? 0;
    const rateValue = this.request.rates?.rate;
    const rateLines = this.buildRateLines(rateValue, amount);
    const ibanLine = this.buildIbanLine(ibanMethod?.iban, accessType);
    const lines: Array<string | null> = [
      this.buildHeaderLine(),
      `💵<b>Сумма:</b> <code>${amount}</code>`,
      ...rateLines,
      ibanMethod?.name ? `👤<b>Имя:</b> <code>${ibanMethod.name}</code>` : null,
      ibanLine,
      ibanMethod?.inn ? `📋<b>ИНН:</b> <code>${ibanMethod.inn}</code>` : null,
      ibanMethod?.comment ? `💬<b>Комментарий:</b> <code>${ibanMethod.comment}</code>` : null,
    ];

    if ((accessType === 'ADMIN' || accessType === 'WORKER') && this.request.activeUser?.username) {
      lines.push(`<b>Принята:</b> @${this.request.activeUser.username}`);
    }

    if (accessType === 'ADMIN') {
      if (this.request.payedByUser?.username) {
        lines.push(`<b>Оплачено:</b> @${this.request.payedByUser.username}`);
      }
      lines.push(`<b>Партнер:</b> <code>${this.request.vendor?.title ?? '-'}</code>`);
    }

    return this.joinMessageLines(lines);
  }

  private buildUnknownPaymentMessage(): string {
    return this.joinMessageLines([
      this.buildHeaderLine(),
      'Неизвестный тип платежа',
    ]);
  }

  private buildHeaderLine(): string {
    return `✉️<b>Заявка номер:</b> <code>${this.request.id ?? '-'}</code>`;
  }

  private buildRateLines(rateValue: number | null | undefined, amount: number): string[] {
    if (!rateValue) {
      return [];
    }
    const lines = [`💱<b>Курс:</b> <code>${rateValue}</code>`];
    if (rateValue) {
      lines.push(`💎<b>USDT:</b> <code>${(amount / rateValue).toFixed(2)}</code>`);
    }
    return lines;
  }

  private buildCardNumberLine(cardNumber: string | undefined, accessType: AccessType): string | null {
    if (!cardNumber) {
      return null;
    }
    const masked = this.maskValue(cardNumber);
    const visibleNumber =
      accessType === 'PUBLIC' || this.isWorkGroup
        ? cardNumber
        : this.isHubGroup && !this.isWorkGroup
          ? masked
          : cardNumber;
    return `💳<b>Номер карты:</b> <code>${visibleNumber}</code>`;
  }

  private buildIbanLine(iban: string | undefined, accessType: AccessType): string | null {
    if (!iban) {
      return null;
    }
    const masked = iban.replace(/.(?=.{4})/g, '*');
    const value =
      accessType === 'PUBLIC' || this.isWorkGroup
        ? iban
        : this.isHubGroup && !this.isWorkGroup
          ? masked
          : iban;
    return `🏦<b>IBAN:</b> <code>${value}</code>`;
  }

  private maskValue(value: string): string {
    return Array.from(value, () => '*').join('');
  }

  private joinMessageLines(lines: Array<string | null | undefined>): string {
    return lines
      .filter((line): line is string => Boolean(line && line.length > 0))
      .join('\n');
  }

  inWork(url?: string, requestId?: string): MenuWithMedia {
    const accessType = this.getAccessType();
    let markup: InlineKeyboardMarkup;
    switch (accessType) {
      case 'ADMIN':
        markup = Markup.inlineKeyboard([
          [
            createButton(BUTTON_TEXTS.ADMIN_IN_WORK, BUTTON_CALLBACKS.DUMMY),
            createButton(
              BUTTON_TEXTS.ADMIN_CANCEL_REQUEST,
              BUTTON_CALLBACKS.ADMIN_CANCEL_REQUEST + requestId,
            ),
          ],
        ]).reply_markup;
        break;
      case 'WORKER':
        markup = requestId
          ? Markup.inlineKeyboard([
              [
                createButton(
                  BUTTON_TEXTS.TAKE_REQUEST,
                  BUTTON_CALLBACKS.TAKE_REQUEST + requestId,
                ),
              ],
            ]).reply_markup
          : createSingleButtonMarkup(
              BUTTON_TEXTS.IN_WORK,
              BUTTON_CALLBACKS.IN_WORK,
            );
        break;
      case 'PUBLIC':
      default:
        markup = createSingleButtonMarkup(
          BUTTON_TEXTS.IN_WORK,
          BUTTON_CALLBACKS.IN_WORK,
        );
        break;
    }
    return new MenuWithMedia(
      this.messageFromRequest(),
      markup,
      url || this.url,
    );
  }
  inProcess(url?: string, requestId?: string): Menu {
    const markup = createSingleButtonMarkup(
      BUTTON_TEXTS.IN_WORK,
      BUTTON_CALLBACKS.IN_WORK,
    );
    const newCancelButton = Markup.button.callback(
      'Отмена',
      'cancel_payment_' + requestId,
    );
    const inline_keyboard = requestId
      ? Markup.inlineKeyboard([
          [
            createButton(
              BUTTON_TEXTS.REQUEST_COMPLIED,
              BUTTON_CALLBACKS.REQUEST_COMPLIED + requestId,
            ),
            newCancelButton,
          ],
        ]).reply_markup
      : markup;
    return new Menu(this.messageFromRequest(), inline_keyboard);
  }

  done(url?: string): MenuWithMedia {
    const markup = createSingleButtonMarkup(
      BUTTON_TEXTS.DONE,
      BUTTON_CALLBACKS.DONE,
    );
    return new MenuWithMedia(
      this.messageFromRequest(),
      markup,
      url || this.url,
      undefined,
      this.source,
    );
  }
  canceled(url?: string, requestId?: string) {
    const accessType = this.getAccessType();
    if (accessType === 'WORKER' && requestId) {
      const markup = Markup.inlineKeyboard([
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
      return new MenuWithMedia(
        this.messageFromRequest(),
        markup,
        url || this.url,
      );
    } else if (accessType === 'ADMIN' && requestId) {
      const markup = Markup.inlineKeyboard([
        [
          createButton(
            BUTTON_TEXTS.REJECTED_BY_ADMIN,
            BUTTON_CALLBACKS.REJECTED_BY_ADMIN,
          ),
        ],
      ]).reply_markup;
      return new MenuWithMedia(
        this.messageFromRequest(),
        markup,
        url || this.url,
      );
    } else {
      return new MenuWithMedia(
        this.messageFromRequest(),
        createSingleButtonMarkup(
          BUTTON_TEXTS.BACK,
          BUTTON_CALLBACKS.RETURN_TO_REQUEST_MENU,
        ),
        url || this.url,
      );
    }
  }
  rejected(url?: string): MenuWithMedia {
    const markup = createSingleButtonMarkup(
      BUTTON_TEXTS.REJECTED,
      BUTTON_CALLBACKS.REJECTED,
    );

    return new MenuWithMedia(
      this.messageFromRequest(),
      markup,
      url || this.url,
    );
  }
}

class PublicMenu extends BaseRequestMenu {
  protected getAccessType(): AccessType {
    return 'PUBLIC';
  }
}

class WorkMenu extends BaseRequestMenu {
  protected getAccessType(): AccessType {
    return 'WORKER';
  }
}

class AdminMenu extends BaseRequestMenu {
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

// Константы для кнопок и сообщений
export const BUTTON_TEXTS = {
  IN_WORK: 'В работе',
  DONE: '✅Выполнено',
  REJECTED: '🚫Отклонено',
  BACK: 'Назад',
  CARD: 'CARD',
  IBAN: 'IBAN',
  CANCEL: 'Отменить',
  TAKE_REQUEST: 'Взять заявку',
  WORKER_CANCEL_REQUEST: 'Отказаться',
  ADMIN_CANCEL_REQUEST: 'Отменить заявку',
  ADMIN_IN_WORK: 'В работе',
  REQUEST_COMPLIED: 'Перевел',
  GIVE_NEXT: 'Передать другому',
  VALUT_CARD: 'Валютная карта',
  BACK_TO_TAKE_REQUEST: 'Отказаться от заявки',
  REJECTED_BY_ADMIN: 'Отклонено админом',
} as const;

export const BUTTON_CALLBACKS = {
  REJECTED_BY_ADMIN: 'rejected_by_admin_',
  GIVE_NEXT: 'give_next_',
  VALUT_CARD: 'valut_card_',
  BACK_TO_TAKE_REQUEST: 'back_to_take_request_',
  WORKER_CANCEL_REQUEST: 'worker_cancel_request_',
  REQUEST_COMPLIED: 'proceeded_payment_',
  IN_WORK: 'in_work',
  DONE: 'done',
  REJECTED: 'rejected',
  RETURN_TO_REQUEST_MENU: 'return_to_request_menu',
  CARD_REQUEST: 'card_request',
  IBAN_REQUEST: 'iban_request',
  CANCEL_REQUEST: 'cancel_request',
  TAKE_REQUEST: 'accept_request_',
  CANCEL_WORKER_REQUEST: 'cancel_worker_request_',
  DUMMY: 'dummy',
  ADMIN_CANCEL_REQUEST: 'admin_cancel_request_',
} as const;

const MESSAGES = {
  SELECT_PAYMENT_METHOD: (username: string) =>
    `@${username} Выберите метод перевода`,
  CARD_PAYMENT_FORM: (username: string) =>
    `@${username} отправьте, пожалуйста, заявку в форме:\n\n Карта сумма (5168745632147896 1000)`,
  IBAN_PAYMENT_FORM: (username: string) =>
    `@${username} отправьте, пожалуйста, заявку в форме:\nИмя\nIBAN\nИНН\nСумма\nКомментарий (если нужно)`,
  NO_DATA: 'Нет данных для отображения',
} as const;

// Вспомогательные функции для создания кнопок
const createButton = (text: string, callback: string) =>
  Markup.button.callback(text, callback);

const createSingleButtonMarkup = (text: string, callback: string) =>
  Markup.inlineKeyboard([[createButton(text, callback)]]).reply_markup;
