import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import { Markup } from 'telegraf';
import { BUTTON_CALLBACKS, BUTTON_TEXTS } from '../telegram/telegram-keyboards';
import {
  CurrencyEnum,
  PaymentMethod,
  PaymentMethodEnum,
} from '@prisma/client';

const POPULAR_CURRENCY_ORDER: CurrencyEnum[] = [
  CurrencyEnum.UAH,
  CurrencyEnum.USD,
  CurrencyEnum.EUR,
  CurrencyEnum.KZT,
  CurrencyEnum.AZN,
  CurrencyEnum.AED,
  CurrencyEnum.CNY,
  CurrencyEnum.PLN,
  CurrencyEnum.TRY,
  CurrencyEnum.CZK,
  CurrencyEnum.THB,
];

const PAYMENT_METHOD_LABELS: Record<PaymentMethodEnum, string> = {
  [PaymentMethodEnum.CARD]: 'карта',
  [PaymentMethodEnum.IBAN]: 'IBAN',
  [PaymentMethodEnum.IBAN_COMPANY]: 'IBAN с ФОП на ФОП/ТОВ',
  [PaymentMethodEnum.PHONE]: 'телефон',
  [PaymentMethodEnum.WISE]: 'Wise',
  [PaymentMethodEnum.SKRILL]: 'Skrill',
  [PaymentMethodEnum.QR]: 'QR-код',
  [PaymentMethodEnum.BANK]: 'Банковская оплата',
  [PaymentMethodEnum.PAYONEER]: 'PAYONEER',
  [PaymentMethodEnum.KZT_KASPI_BANK]: 'Kaspi Bank',
  [PaymentMethodEnum.KZT_OTHER_BANKS]: 'Остальные банки',
  [PaymentMethodEnum.CNY_ALIPAY]: 'Alipay',
  [PaymentMethodEnum.CNY_WECHAT]: 'WeChat Pay',
  [PaymentMethodEnum.CNY_CARD]: 'карта',
  [PaymentMethodEnum.CNY_ACCOUNT]: 'номер счета',
  [PaymentMethodEnum.REVOLUT]: 'Revolut',
  [PaymentMethodEnum.AMD_IDRAM]: 'Idram',
  [PaymentMethodEnum.KGS_ELCART]: 'Elcart',
  [PaymentMethodEnum.INR_UPI]: 'UPI',
  [PaymentMethodEnum.INR_PAYTM]: 'Paytm',
  [PaymentMethodEnum.BRL_PIX]: 'Pix',
  [PaymentMethodEnum.BRL_ATM_QR]: 'ATM QR-код',
  [PaymentMethodEnum.ARS_MERCADO_PAGO]: 'Mercado Pago',
  [PaymentMethodEnum.PAYPAL]: 'PayPal',
};

const CHUNK_SIZE = 2;

@Injectable()
export class CurrencyService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll() {
    const currencies = await this.prisma.currency.findMany({
      include: { Rates: true, paymentMethod: true },
    });

    return Promise.all(
      currencies.map((currency) => this.attachMissingPaymentMethods(currency)),
    );
  }
  async findById(id: string) {
    const currency = await this.prisma.currency.findUnique({
      where: { id },
      include: { paymentMethod: true, Rates: true },
    });
    if (!currency) {
      return null;
    }

    return this.attachMissingPaymentMethods(currency);
  }
  async getCurrencyKeyboard(userId?: number) {
    const currencies = await this.getAll();
    const popularIndex = (code: string) => {
      const idx = POPULAR_CURRENCY_ORDER.indexOf(code as CurrencyEnum);
      return idx === -1 ? POPULAR_CURRENCY_ORDER.length : idx;
    };
    const buttons = currencies
      .filter((c) => c.Rates && c.Rates.length > 0)
      .sort((a, b) => {
        const aIndex = popularIndex(a.name as string);
        const bIndex = popularIndex(b.name as string);
        if (aIndex !== bIndex) {
          return aIndex - bIndex;
        }
        const aRates = a.Rates?.length ?? 0;
        const bRates = b.Rates?.length ?? 0;
        if (aRates !== bRates) {
          return bRates - aRates;
        }
        return a.nameEn.localeCompare(b.nameEn);
      })
      .map((currency) => {
        const methods = Array.from(
          new Set(
            (currency.paymentMethod || []).map((method) =>
              PAYMENT_METHOD_LABELS[method.nameEn as PaymentMethodEnum] ||
              method.nameEn.toLowerCase(),
            ),
          ),
        );
        const methodLabel = methods.length ? ` • ${methods.join(' / ')}` : '';
        const text = `${currency.nameEn}`;
        return Markup.button.callback(
          text,
          `select_currency_${currency.id}${userId ? `_${userId}` : ''}`,
        );
      });
    const caption =
      'Выберите валюту и удобный способ получения перевода:';
    const cancelRequest = Markup.button.callback(
      BUTTON_TEXTS.CANCEL,
      BUTTON_CALLBACKS.CANCEL_REQUEST,
    );
    const rows = this.buildKeyboardRows(buttons, cancelRequest);
    const markup: InlineKeyboardMarkup = Markup.inlineKeyboard(rows).reply_markup;
    return {
      caption,
      markup,
    };
  }

  private buildKeyboardRows(
    buttons: ReturnType<typeof Markup.button.callback>[],
    cancelButton: ReturnType<typeof Markup.button.callback>,
  ): ReturnType<typeof Markup.inlineKeyboard>['reply_markup']['inline_keyboard'] {
    const rows: typeof buttons[] = [];
    for (let i = 0; i < buttons.length; i += CHUNK_SIZE) {
      rows.push(buttons.slice(i, i + CHUNK_SIZE));
    }
    rows.push([cancelButton]);
    return rows;
  }

  private async attachMissingPaymentMethods<T extends {
    paymentMethod: PaymentMethod[];
    Rates: { paymentMethodId: string | null }[];
  }>(currency: T): Promise<T> {
    const rateMethodIds = new Set(
      currency.Rates.map((rate) => rate.paymentMethodId).filter(
        (id): id is string => Boolean(id),
      ),
    );
    const existingMethodIds = new Set(currency.paymentMethod.map((method) => method.id));
    const missingIds = [...rateMethodIds].filter((id) => !existingMethodIds.has(id));

    if (missingIds.length > 0) {
      const missingMethods = await this.prisma.paymentMethod.findMany({
        where: { id: { in: missingIds } },
      });
      if (missingMethods.length > 0) {
        currency.paymentMethod = [...currency.paymentMethod, ...missingMethods];
      }
    }

    return currency;
  }
}
