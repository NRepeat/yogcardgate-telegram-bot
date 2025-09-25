import { Markup } from 'telegraf';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';

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

export const MESSAGES = {
  SELECT_PAYMENT_METHOD: (username: string) =>
    `@${username} Выберите метод перевода`,
  CARD_PAYMENT_FORM: (username: string) =>
    `@${username} отправьте, пожалуйста, заявку в форме:\n\n Карта сумма (5168745632147896 1000)`,
  IBAN_PAYMENT_FORM: (username: string) =>
    `@${username} отправьте, пожалуйста, заявку в форме:\nИмя\nIBAN\nИНН\nСумма\nКомментарий (если нужно)`,
  NO_DATA: 'Нет данных для отображения',
} as const;

export const createButton = (text: string, callback: string) =>
  Markup.button.callback(text, callback);

export const createSingleButtonMarkup = (
  text: string,
  callback: string,
): InlineKeyboardMarkup =>
  Markup.inlineKeyboard([[createButton(text, callback)]]).reply_markup;
