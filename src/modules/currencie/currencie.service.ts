import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import { Markup } from 'telegraf';
import { BUTTON_CALLBACKS, BUTTON_TEXTS } from '../telegram/telegram-keyboards';
import { CurrencyEnum, PaymentMethodEnum } from '@prisma/client';

const POPULAR_CURRENCY_ORDER: CurrencyEnum[] = [
  CurrencyEnum.USD,
  CurrencyEnum.EUR,
  CurrencyEnum.UAH,
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
  [PaymentMethodEnum.BANK_ACCOUNT]: 'ваер',
  [PaymentMethodEnum.PHONE]: 'телефон',
  [PaymentMethodEnum.SKRILL_EMAIL]: 'Skrill',
  [PaymentMethodEnum.QR]: 'QR-код',
};

const CHUNK_SIZE = 2;

@Injectable()
export class CurrencyService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll() {
    return this.prisma.currency.findMany({
      include: { Rates: true, paymentMethod: true },
    });
  }
  async findById(id: string) {
    return this.prisma.currency.findUnique({
      where: { id },
      include: { paymentMethod: true, Rates: true },
    });
  }
  async getCurrencyKeyboard() {
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
          `select_currency_${currency.id}`,
        );
      });
    const caption =
      'Выберите валюту и удобный способ получения перевода:';
    const cancelRequest = Markup.button.callback(
      BUTTON_TEXTS.CANCEL,
      BUTTON_CALLBACKS.CANCEL_REQUEST,
    );
    const rows: typeof buttons[] = [];
    for (let i = 0; i < buttons.length; i += CHUNK_SIZE) {
      rows.push(buttons.slice(i, i + CHUNK_SIZE));
    }
    rows.push([cancelRequest]);
    const markup: InlineKeyboardMarkup = Markup.inlineKeyboard(rows).reply_markup;
      return {
      caption,
      markup,
    };
  }
}
