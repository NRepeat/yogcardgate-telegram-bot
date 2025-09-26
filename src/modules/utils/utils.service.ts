import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { VendorService } from '../vendor/vendor.service';
import { Context, Markup } from 'telegraf';
import {
  FullRequestType,
  MessageAccessType,
  ReplyMessage,
} from 'src/types/types';
import { PaymentMethodEnum } from '@prisma/client';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import * as sharp from 'sharp';
import { RatesService } from '../rates/rates.service';
import { PrismaService } from '../prisma/prisma.service';
import { getParamByParam } from 'iso-country-currency';

const POPULAR_CURRENCY_ORDER = [
  'UAH',
  'USD',
  'EUR',
  'KZT',
  'AZN',
  'AED',
  'CNY',
  'PLN',
  'TRY',
  'CZK',
  'THB',
];


const CURRENCY_TO_SKIP_RANGE = [
  'USD',
  'EUR',
  'KZT',
  'AZN',
  'AED',
  'CNY',
  'PLN',
  'TRY',
  'CZK',
  'THB',
]

@Injectable()
export class UtilsService {
  constructor(
    private readonly userService: UserService,
    private readonly vendorService: VendorService,
    @Inject(forwardRef(() => RatesService))
    private readonly ratesService: RatesService,
    private readonly prismaService: PrismaService, // Assuming you have a PrismaService to inject
  ) {}
  async getBankNameByCardNumber(cardNumber: string) {
    // console.log(`Fetching bank name for card number: ${cardNumber}`);
    // Try exact match first
    let card = await this.prismaService.cardBank.findFirst({
      where: { number: cardNumber },
    });
    // If not found, try by BIN (first 6 digits)
    if (!card && cardNumber.length >= 6) {
      const bin = cardNumber.slice(0, 6);
      card = await this.prismaService.cardBank.findFirst({
        where: { number: bin },
      });
    }
    if (!card) {
      // console.log(`No bank found for card number: ${cardNumber}`);
      return null;
    }
    // console.log(`Found bank: ${card.bankName}`);
    return card;
  }
  async isChatRegistrated(ctx: Context) {
    const existVendor = await this.vendorService.isVendorChat(ctx);

    if (existVendor) {
      return true;
    }
    return false;
  }

  async getAllPublicRatesMarkupMessage() {
    
    const allRates = await this.ratesService.getAllRates();
    if (!allRates.length) return 'Нет доступных курсов.';
    // Сортируем: сначала Card, затем остальные, внутри Card — сначала + (maxAmount === null/0), потом по minAmount по убыванию
    type Rate = (typeof allRates)[number];
    function plusFirstSort(a: Rate, b: Rate) {
      const aPlus = !a.maxAmount || a.maxAmount === 0;
      const bPlus = !b.maxAmount || b.maxAmount === 0;
      if (aPlus && !bPlus) return -1;
      if (!aPlus && bPlus) return 1;
      return (b.minAmount ?? 0) - (a.minAmount ?? 0);
    }
    const cardRates = allRates
      .filter((r) => r.paymentMethod.nameEn.toLowerCase() === 'card')
      .sort(plusFirstSort);
    const otherRates = allRates
      .filter((r) => r.paymentMethod.nameEn.toLowerCase() !== 'card')
      .sort(plusFirstSort);
    const sortedRates = [...cardRates, ...otherRates];

    const currencyPopularityIndex = (code: string | null | undefined) => {
      if (!code) {
        return POPULAR_CURRENCY_ORDER.length;
      }
      const upperCased = code.toUpperCase();
      const index = POPULAR_CURRENCY_ORDER.indexOf(upperCased);
      return index === -1 ? POPULAR_CURRENCY_ORDER.length : index;
    };

    const groupedByCurrency = new Map<
      string,
      {
        displayName: string;
        methods: Map<string, string[]>;
        popularityIndex: number;
        symbol: string | null;
      }
    >();

    for (const rate of sortedRates) {
      const currencyCode = String(
        rate.currency.nameEn ?? rate.currency.name ?? '',
      );
      const currencyDisplayName = String(
        rate.currency.name ?? rate.currency.nameEn ?? currencyCode,
      );
      if (!groupedByCurrency.has(currencyCode)) {
        const symbol = this.resolveCurrencySymbol(currencyCode);
        groupedByCurrency.set(currencyCode, {
          displayName: currencyDisplayName,
          methods: new Map(),
          popularityIndex: currencyPopularityIndex(currencyCode),
          symbol,
        });
      }

      const currencyGroup = groupedByCurrency.get(currencyCode)!;
      const methodKey = rate.paymentMethod.nameEn;
      const amountLabel =
        rate.maxAmount !== null && rate.maxAmount > 0
          ? `${rate.minAmount} - ${rate.maxAmount}`
          : `${rate.minAmount}+`;
      const line = `•[${amountLabel}] — ${rate.rate}`;
      const lineWithoutAmount = `— ${rate.rate}`;
      if (!currencyGroup.methods.has(methodKey)) {
        currencyGroup.methods.set(methodKey, []);
      }
      if (!CURRENCY_TO_SKIP_RANGE.includes(currencyCode)) {
        currencyGroup.methods.get(methodKey)!.push(line);
      } else {
        currencyGroup.methods.get(methodKey)!.push(lineWithoutAmount);
      }
    }

    const message: string[] = ['📍Актуальный курс:'];

    const sortedCurrencies = Array.from(groupedByCurrency.entries()).sort(
      ([codeA, groupA], [codeB, groupB]) => {
        if (groupA.popularityIndex !== groupB.popularityIndex) {
          return groupA.popularityIndex - groupB.popularityIndex;
        }
        return codeA.localeCompare(codeB);
      },
    );

    for (const [currencyCode, group] of sortedCurrencies) {
      const symbol = group.symbol ?? null;
      const shouldShowSymbol =
        symbol !== null &&
        symbol.trim().length > 0 &&
        symbol.trim().length <= 3 &&
        symbol.trim().toUpperCase() !== currencyCode.toUpperCase() &&
        symbol.trim().toUpperCase() !== group.displayName.trim().toUpperCase();

      const currencyLabel = shouldShowSymbol
        ? `${symbol} ${group.displayName}`
        : group.displayName;

      for (const [method, lines] of group.methods) {
        if (CURRENCY_TO_SKIP_RANGE.includes(currencyCode)) {
          message.push(
            `${currencyLabel} ${method.toUpperCase()} ${lines.join('\n')}`,
          );
        } else {
          message.push(`${currencyLabel} ${method.toUpperCase()}`);
          message.push(...lines);
        }
      }

      message.push('');
    }

    return message.join('\n').trim();
  }

  private resolveCurrencySymbol(currencyCode: string): string | null {
    try {
      const symbol = getParamByParam('currency', currencyCode, 'symbol');
      return symbol ? symbol.trim() || null : null;
    } catch (error) {
      return null;
    }
  }
  // Группируем по header

  buildRequestMessage(
    request: FullRequestType,
    method: 'card' | 'iban',
    accessType: MessageAccessType,
  ): ReplyMessage {
    const message = {
      card: this.buildCardRequestMessage(request, accessType),
      iban: this.buildIbanRequestMessage(request, accessType),
    };

    return message[method];
  }

  buildIbanRequestMessage(
    request: FullRequestType,
    accessType: MessageAccessType,
  ) {
    const ibanMethod = request.methods?.find(
      (method) => method.method === PaymentMethodEnum.IBAN,
    )?.ibanDetails;

    if (!ibanMethod) {
      return {
        text: 'Нет доступных IBAN методов для этой заявки.',
        inline_keyboard: [],
      };
    }
    // Формируем текст сообщения
    let text =
      `Заявка на перевод по IBAN\n` +
      `Имя: ${ibanMethod.name || '-'}\n` +
      `IBAN: ${ibanMethod.iban || '-'}\n` +
      `ИНН: ${ibanMethod.inn || '-'}\n` +
      `Сумма: ${request.amount} ${request.currency?.nameEn}\n` +
      (ibanMethod.comment ? `Комментарий: ${ibanMethod.comment}\n` : '');

    let inline_keyboard;
    if (accessType === 'admin') {
      inline_keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('Отказаться', 'cancel_request')],
        [Markup.button.callback('Не в работе', 'dummy')],
      ]).reply_markup;
      text += `\n\n` + 'Заявка принята: ' + request.user?.username;
    } else if (accessType === 'worker') {
      inline_keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('Отказаться', 'cancel_request')],
        [Markup.button.callback('Взять', 'accept_request_' + request.id)],
      ]).reply_markup;
    } else {
      inline_keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('В работе', 'dummy')],
      ]).reply_markup;
    }

    return {
      text,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      inline_keyboard,
    };
  }
  buildCardRequestMessage(
    request: FullRequestType,
    accessType: MessageAccessType,
  ) {
    const cardMethod = request.methods?.find(
      (method) => method.method === PaymentMethodEnum.CARD,
    )?.cardDetails;
    const card = cardMethod?.card ?? '-';
    const bank = cardMethod?.bank?.bankName ?? '-';
    const amount = request.amount || 0;
    const rate = request.rates?.rate || 0;
    const usdt = (amount / rate).toFixed(2);
    const isBlacklisted = Boolean(cardMethod?.blackList?.length);
    const blacklist =
      isBlacklisted && cardMethod?.blackList?.[0]
        ? '🚫Карта в чёрном списке: ' + cardMethod.blackList[0].reason
        : '';
    const acceptedBy = request?.activeUser
      ? 'Принята:@' + request.activeUser.username
      : '';

    let message = '';
    let inline_keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [],
    };
    switch (accessType) {
      case 'public': {
        message =
          `✉️Заявка номер: ${request.id ? request.id : '-'}\n` +
          `🏦Банк: ${bank || '-'}\n` +
          `💵Сумма: ${amount}\n` +
          `💎USDT: ${usdt} \n` +
          `💳Номер карты: ${card}\n` +
          `💱Курс: ${typeof rate === 'number' ? rate.toFixed(2) : '-'}\n`;
        inline_keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('В работе', 'dummy')],
        ]).reply_markup;
        break;
      }
      case 'admin':
        {
          message =
            `✉️Заявка номер: ${request.id ? request.id : '-'}\n` +
            `🏦Банк: ${bank || '-'}\n` +
            `💵Сумма: ${amount}\n` +
            `💎USDT: ${usdt} \n` +
            `💳Номер карты: ${card}\n` +
            `💱Курс: ${typeof rate === 'number' ? rate.toFixed(2) : '-'}\n` +
            acceptedBy +
            (isBlacklisted ? '🚫Карта в чёрном списке: ' + blacklist : '');
        }
        inline_keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('Отказаться', 'cancel_request')],
          [Markup.button.callback('Не в работе', 'dummy')],
        ]).reply_markup;
        break;
      case 'worker': {
        message =
          `✉️Заявка номер: ${request.id ? request.id : '-'}\n` +
          `🏦Банк: ${bank || '-'}\n` +
          `💵Сумма: ${amount}\n` +
          `💎USDT: ${usdt} \n` +
          `💳Номер карты: ${card}\n` +
          `💱Курс: ${typeof rate === 'number' ? rate.toFixed(2) : '-'}\n` +
          (isBlacklisted ? '🚫Карта в чёрном списке: ' + blacklist : '');
        inline_keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('Отказаться', 'cancel_request')],
          [Markup.button.callback('Взять', 'accept_request_' + request.id)],
        ]).reply_markup;
        break;
      }
      default: {
        return {
          text: message,
          inline_keyboard: inline_keyboard,
        };
      }
    }
    return {
      text: message,
      inline_keyboard: inline_keyboard,
    };
  }
  async downloadTelegramPhoto(
    botToken: string,
    fileId: string,
  ): Promise<Buffer> {
    const fileInfo = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`,
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { result } = await fileInfo.json();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const url = `https://api.telegram.org/file/bot${botToken}/${result.file_path}`;
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  async mergeImagesHorizontal(images: Buffer[]): Promise<Buffer> {
    const sharpImages = images.map((img) => sharp(img));
    const metadatas = await Promise.all(
      sharpImages.map((img) => img.metadata()),
    );
    const totalWidth = metadatas.reduce(
      (sum, meta) => sum + (meta.width || 0),
      0,
    );
    const height = Math.max(...metadatas.map((meta) => meta.height || 0));

    const resizedBuffers = await Promise.all(
      sharpImages.map((img) => img.resize({ height }).toBuffer()),
    );

    let left = 0;
    const composites = resizedBuffers.map((buffer, i) => {
      const composite = { input: buffer, top: 0, left };
      left += metadatas[i].width || 0;
      return composite;
    });

    return sharp({
      create: {
        width: totalWidth,
        height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      },
    })
      .composite(composites)
      .png()
      .toBuffer();
  }
}
