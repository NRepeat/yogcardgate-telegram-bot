import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import { Markup } from 'telegraf';
import { BUTTON_CALLBACKS, BUTTON_TEXTS } from '../telegram/telegram-keyboards';

@Injectable()
export class CurrencyService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll() {
    return this.prisma.currency.findMany({
      orderBy: { nameEn: 'asc' },
    });
  }
  async findById(id: string) {
    return this.prisma.currency.findUnique({
      where: { id },
      include: { paymentMethod: true },
    });
  }
  async getCurrencyKeyboard() {
    const currencies = await this.getAll();
    const buttons = currencies.map((currency) =>
      Markup.button.callback(
        `${currency.nameEn} (${currency.code})`,
        `select_currency_${currency.id}`,
      ),
    );
    const caption = 'Select currency:';
    const cancelRequest = Markup.button.callback(
      BUTTON_TEXTS.CANCEL,
      BUTTON_CALLBACKS.CANCEL_REQUEST,
    );
    const markup: InlineKeyboardMarkup = Markup.inlineKeyboard([
      [...buttons, cancelRequest],
    ]).reply_markup;
    return {
      caption,
      markup,
    };
  }
}
