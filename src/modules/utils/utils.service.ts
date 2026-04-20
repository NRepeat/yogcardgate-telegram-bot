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
  '',
  // 'USD',
  // 'EUR',
  // 'KZT',
  // 'AZN',
  // 'AED',
  // 'CNY',
  // 'PLN',
  // 'TRY',
  // 'CZK',
  // 'THB',
];

const CURRENCY_FLAGS: Record<string, string> = {
  UAH: '🇺🇦',
  USD: '🇺🇸',
  EUR: '🇪🇺',
  KZT: '🇰🇿',
  AZN: '🇦🇿',
  AED: '🇦🇪',
  CNY: '🇨🇳',
  PLN: '🇵🇱',
  TRY: '🇹🇷',
  CZK: '🇨🇿',
  THB: '🇹🇭',
};

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
        methods: Map<string, { lines: string[]; hasEnabled: boolean }>;
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

      if (!currencyGroup.methods.has(methodKey)) {
        currencyGroup.methods.set(methodKey, { lines: [], hasEnabled: false });
      }

      const methodData = currencyGroup.methods.get(methodKey)!;

      // Only add lines for enabled rates
      if (rate.enabled) {
        methodData.hasEnabled = true;
        const amountLabel =
          rate.maxAmount !== null && rate.maxAmount > 0
            ? `${rate.minAmount} - ${rate.maxAmount}`
            : `${rate.minAmount}+`;
        const line = `•[${amountLabel}] — ${rate.rate}`;
        const lineWithoutAmount = `— ${rate.rate}`;

        if (!CURRENCY_TO_SKIP_RANGE.includes(currencyCode)) {
          methodData.lines.push(line);
        } else {
          methodData.lines.push(lineWithoutAmount);
        }
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
      const flag = CURRENCY_FLAGS[currencyCode.toUpperCase()] ?? '';
      const shouldShowSymbol =
        symbol !== null &&
        symbol.trim().length > 0 &&
        symbol.trim().length <= 3 &&
        symbol.trim().toUpperCase() !== currencyCode.toUpperCase() &&
        symbol.trim().toUpperCase() !== group.displayName.trim().toUpperCase();

      const currencyLabel = shouldShowSymbol
        ? `${flag} ${symbol} ${group.displayName}`.trim()
        : `${flag} ${group.displayName}`.trim();

      for (let [method, methodData] of group.methods) {
        let methodLabel = method;
        let headerLabel = currencyLabel;

        if (method === 'KZT_KASPI_BANK') {
          methodLabel = 'Kaspi Bank';
        } else if (method === 'KZT_OTHER_BANKS') {
          methodLabel = 'Остальные банки';
        } else if (method.startsWith('CNY_')) {
          // For CNY methods, strip prefix and use only symbol with flag
          methodLabel = method.replace('CNY_', '');
          headerLabel = symbol ? `${flag} ${symbol}`.trim() : currencyLabel;
        }

        // If no enabled rates in this direction, show "temporarily unavailable"
        if (!methodData.hasEnabled) {
          message.push(
            `${headerLabel} ${methodLabel.toUpperCase()} - временно не доступен`,
          );
        } else {
          if (CURRENCY_TO_SKIP_RANGE.includes(currencyCode)) {
            message.push(
              `${headerLabel} ${methodLabel.toUpperCase()} ${methodData.lines.join('\n')}`,
            );
          } else {
            message.push(`${headerLabel} ${methodLabel.toUpperCase()}`);
            message.push(...methodData.lines);
          }
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

    // Use 3 decimal places for USD/EUR/GBP, 2 for others
    const currencyCode = request.currency?.nameEn?.toUpperCase();
    const decimals = ['USD', 'EUR', 'GBP'].includes(currencyCode || '') ? 4 : 4;

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
          `💱Курс: ${typeof rate === 'number' ? String(rate) : '-'}\n`;
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
            `💱Курс: ${typeof rate === 'number' ? rate.toFixed(decimals) : '-'}\n` +
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
          `💱Курс: ${typeof rate === 'number' ? rate.toFixed(decimals) : '-'}\n` +
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
  async mergeImagesGrid(images: Buffer[], columns = 2): Promise<Buffer> {
    if (images.length === 1) return images[0];

    const cellWidth = 800;
    const cols = Math.min(columns, images.length);
    const rows = Math.ceil(images.length / cols);

    const resizedBuffers = await Promise.all(
      images.map((img) =>
        sharp(img).resize({ width: cellWidth, fit: 'inside' }).toBuffer(),
      ),
    );
    const metadatas = await Promise.all(
      resizedBuffers.map((buf) => sharp(buf).metadata()),
    );

    const rowHeights: number[] = [];
    for (let r = 0; r < rows; r++) {
      let maxH = 0;
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx < metadatas.length) {
          maxH = Math.max(maxH, metadatas[idx].height || 0);
        }
      }
      rowHeights.push(maxH);
    }

    const totalWidth = cellWidth * cols;
    const totalHeight = rowHeights.reduce((s, h) => s + h, 0);

    const composites: { input: Buffer; top: number; left: number }[] = [];
    let topOffset = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx < resizedBuffers.length) {
          composites.push({
            input: resizedBuffers[idx],
            top: topOffset,
            left: c * cellWidth,
          });
        }
      }
      topOffset += rowHeights[r];
    }

    return sharp({
      create: {
        width: totalWidth,
        height: totalHeight,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite(composites)
      .jpeg({ quality: 85 })
      .toBuffer();
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
