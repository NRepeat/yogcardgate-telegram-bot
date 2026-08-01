import { Injectable, Inject, forwardRef } from '@nestjs/common';

import { ParsedMessageRates, SerializedRate } from 'src/types/types';
import RateRepository from './rates.repo';
import { Context } from 'telegraf';
import Rate from 'src/model/Rate';
import { VendorService } from '../vendor/vendor.service';
import { PrismaService } from '../prisma/prisma.service';
import { CurrencyEnum, PaymentMethodEnum } from '@prisma/client';
import { UtilsService } from '../utils/utils.service';


const XML_MAP: Record<string, string> = {
  'CARD_UAH': 'CARDUAH',
  'CARD_USD': 'CARDUSD',
  'CARD_EUR': 'CARDEUR',
  'CARD_KZT': 'CARDKZT',
  'CARD_AZN': 'CARDAZN',
  'AZN_OTHER_BANKS_AZN': 'CARDAZN',
  'CARD_CNY': 'CARDCNY',
  'IBAN_UAH': 'WIREUAH',
  'IBAN_PERSONAL_UAH': 'P2PUAH',
  'IBAN_COMPANY_UAH': 'CORPUAH',
  'IBAN_EUR': 'SEPAEUR',
  'EUR_IBAN_BUSINESS_EUR': 'SEPAEUR',
  'IBAN_AED': 'WIREAED',
  'IBAN_PLN': 'WIREPLN',
  'IBAN_TRY': 'WIRETRY',
  'WISE_USD': 'WISEUSD',
  'WISE_EUR': 'WISEEUR',
  'BANK_THB': 'WIRETHB',
  'BANK_CZK': 'WIRECZK',
  'SKRILL_USD': 'SKLUSD',
  'SKRILL_EUR': 'SKLEUR',
  'PAYPAL_USD': 'PPUSD',
  'KZT_KASPI_BANK_KZT': 'KSPBKZT',
  'KZT_OTHER_BANKS_KZT': 'CARDKZT',
  'CNY_ALIPAY_CNY': 'ALPCNY',
  'CNY_WECHAT_CNY': 'WCTCNY',
  'CNY_CARD_CNY': 'CARDCNY',
  'CARD_GBP': 'CARDGBP',
  'IBAN_GBP': 'WIREGBP',
  'WISE_GBP': 'WISEGBP',
  'PAYPAL_GBP': 'PPGBP',
  'REVOLUT_GBP': 'REVBGBP',
  'CARD_SEK': 'CARDSEK',
  'IBAN_SEK': 'WIRESEK',
  'CARD_MDL': 'CARDMDL',
  'CARD_AMD': 'CARDAMD',
  'AMD_IDRAM_AMD': 'IDRAMAMD',
  'CARD_KGS': 'CARDKGS',
  'KGS_ELCART_KGS': 'ELKGS',
  'CARD_BGN': 'CARDBGN',
  'IBAN_BGN': 'WIREBGN',
  'CARD_HUF': 'CARDHUF',
  'CARD_GEL': 'CARDGEL',
  'IBAN_GEL': 'WIREGEL',
  'CARD_TJS': 'CARDTJS',
  'CARD_INR': 'CARDINR',
  'IBAN_INR': 'WIREINR',
  'INR_UPI_INR': 'UPIINR',
  'INR_PAYTM_INR': 'PAYTMINR',
  'CARD_IDR': 'CARDIDR',
  'IBAN_IDR': 'WIREIDR',
  'CARD_RON': 'CARDRON',
  'IBAN_RON': 'WIRERON',
  'CARD_BRL': 'CARDBRL',
  'BRL_PIX_BRL': 'PIXBRL',
  'BRL_ATM_QR_BRL': 'ATMBRL',
  'CARD_ARS': 'CARDARS',
  'IBAN_ARS': 'WIREARS',
  'ARS_MERCADO_PAGO_ARS': 'MPARS',
  'CARD_VND': 'CARDVND',
  'IBAN_VND': 'WIREVND',
};

const POPULAR_CURRENCY_ORDER: string[] = [
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

@Injectable()
export class RatesService {
  // private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly rateRepository: RateRepository,
    private readonly vendorService: VendorService,
    @Inject(forwardRef(() => UtilsService))
    private readonly utilsService: UtilsService,
    private readonly prisma: PrismaService,
  ) {}
  async getAllRates() {
    return this.rateRepository.getAll();
  }

  async getAllEnabledRates() {
    return this.rateRepository.getAllEnabled();
  }

  async getAllRatesMarkupMessage() {
    const allRates = await this.getAllRates();
    type MethodRates = {
      minAmount: number;
      maxAmount: number | null;
      rate: number;
      enabled: boolean;
    };

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
        popularityIndex: number;
        methods: Map<string, MethodRates[]>;
      }
    >();

    for (const rate of allRates) {
      const currencyDisplayName = String(
        rate.currency.nameEn ?? rate.currency.name ?? '',
      );
      const currencyCode = currencyDisplayName.toUpperCase();
      if (!groupedByCurrency.has(currencyCode)) {
        groupedByCurrency.set(currencyCode, {
          displayName: currencyDisplayName,
          popularityIndex: currencyPopularityIndex(currencyCode),
          methods: new Map(),
        });
      }
      const currencyGroup = groupedByCurrency.get(currencyCode)!;
      const methodKey = rate.paymentMethod.nameEn;
      if (!currencyGroup.methods.has(methodKey)) {
        currencyGroup.methods.set(methodKey, []);
      }
      currencyGroup.methods.get(methodKey)!.push({
        minAmount: rate.minAmount,
        maxAmount: rate.maxAmount,
        rate: rate.rate,
        enabled: rate.enabled,
      });
    }

    const message: string[] = [];
    const sortedCurrencies = Array.from(groupedByCurrency.entries()).sort(
      ([codeA, groupA], [codeB, groupB]) => {
        if (groupA.popularityIndex !== groupB.popularityIndex) {
          return groupA.popularityIndex - groupB.popularityIndex;
        }
        return codeA.localeCompare(codeB);
      },
    );

    for (const [, group] of sortedCurrencies) {
      const methods = Array.from(group.methods.entries()).sort(
        ([methodA], [methodB]) => {
          const aIsCard = methodA.toLowerCase().includes('card');
          const bIsCard = methodB.toLowerCase().includes('card');
          if (aIsCard && !bIsCard) return -1;
          if (!aIsCard && bIsCard) return 1;
          return methodA.localeCompare(methodB);
        },
      );

      for (const [methodKey, rates] of methods) {
        // Check if all rates in this direction are disabled
        const allDisabled = rates.every((r) => !r.enabled);
        const headerPrefix = allDisabled ? '#' : '';
        const header = `${headerPrefix}${group.displayName}:${methodKey}`;

        rates.sort((a, b) => {
          if (a.maxAmount === null && b.maxAmount !== null) return 1;
          if (a.maxAmount !== null && b.maxAmount === null) return -1;
          return a.minAmount - b.minAmount;
        });
        rates.reverse();
        message.push(header);
        for (const r of rates) {
          const amount =
            r.maxAmount !== null && r.maxAmount > 0
              ? `${r.minAmount}-${r.maxAmount}`
              : `${r.minAmount}+`;
          const prefix = r.enabled ? '' : '#';
          message.push(`${prefix}${amount} ${r.rate}`);
        }
      }
    }
    return message.join('\n');
  }
  parseAllRatesMarkupMessage(message: string) {
    try {
      const lines = message.split('\n').filter((line) => line.trim() !== '');
      const rates: ParsedMessageRates[] = [];
      let currentHeader = '';

      for (const line of lines) {
        if (line.includes(':')) {
          currentHeader = line;
          rates.push({ header: currentHeader, lines: [] });
        } else if (currentHeader) {
          rates[rates.length - 1].lines.push(line);
        }
      }

      return rates;
    } catch (error) {
      console.error('Error parsing rates markup message:', error);
      return [];
    }
  }

  async createRates(ctx: Context) {
    const message = ctx.text;
    if (!message) {
      console.error('No message text found in context');
      throw new Error('No message text found');
    }

    const parsedRates = this.parseAllRatesMarkupMessage(message);

    const newRates: SerializedRate[] = [];
    for (const parsedRate of parsedRates) {
      // Check if entire direction is disabled (header starts with #)
      const headerTrimmed = parsedRate.header.trim();
      const directionDisabled = headerTrimmed.startsWith('#');
      const cleanHeader = headerTrimmed.replace(/^#/, '').trim();

      const method = cleanHeader.split(':')[1]?.trim();
      const currencyName = cleanHeader.split(':')[0]?.trim();

      if (!method || !currencyName) {
        console.warn(`Invalid header format: ${parsedRate.header}`);
        continue;
      }

      const paymentMethodId =
        PaymentMethodEnum[method as keyof typeof PaymentMethodEnum];
      const currencyId =
        CurrencyEnum[currencyName as keyof typeof CurrencyEnum];

      if (!paymentMethodId || !currencyId) {
        console.warn(
          `Invalid currency or payment method: ${currencyName}:${method}`,
        );
        continue;
      }

      for (const line of parsedRate.lines) {
        let minAmount = 0;
        let maxAmount: number | null = null;
        let rate = 0;
        let enabled = !directionDisabled; // If direction disabled, all rates disabled

        // Check if individual line starts with # (disabled)
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('#')) {
          enabled = false;
        }

        // Remove # prefix, bullets, brackets; normalize em/en dash to space
        const cleanedLine = trimmedLine
          .replace(/^#/, '')
          .replace(/^[•·*\-]+/, '')
          .replace(/[\[\]]/g, '')
          .replace(/[—–−]/g, ' ')
          .replace(/,/g, '.')
          .trim();
        const parts = cleanedLine.split(/\s+/);

        if (parts.length < 2) {
          console.warn(`Invalid line format: ${line}`);
          continue;
        }

        const amountPart = parts[0];
        const ratePart = parts[1];

        rate = Number(ratePart);
        if (isNaN(rate) || rate <= 0) {
          console.warn(`Invalid rate in line: ${line}`);
          continue;
        }

        if (amountPart.includes('+')) {
          minAmount = Number(amountPart.replace('+', ''));
          maxAmount = null;
        } else if (amountPart.includes('-')) {
          const [min, max] = amountPart.split('-');
          minAmount = Number(min);
          maxAmount = Number(max);
        } else {
          minAmount = Number(amountPart);
          maxAmount = null;
        }

        if (isNaN(minAmount) || minAmount < 0) {
          console.warn(`Invalid minAmount in line: ${line}`);
          continue;
        }

        if (maxAmount !== null && (isNaN(maxAmount) || maxAmount < minAmount)) {
          console.warn(`Invalid maxAmount in line: ${line}`);
          continue;
        }

        const newRate = new Rate(
          rate,
          minAmount,
          maxAmount ?? 0,
          currencyId,
          paymentMethodId,
          enabled,
        );
        newRates.push(newRate);
      }
    }
    if (newRates.length === 0) {
      console.error('No valid rates found to create');
      throw new Error('No valid rates found');
    }
    console.log('New rates', newRates);

    const grouped = new Map<
      string,
      {
        currencyKey: CurrencyEnum;
        paymentMethodKey: PaymentMethodEnum;
        rates: SerializedRate[];
      }
    >();

    for (const rate of newRates) {
      const currencyKey = rate.currencyId as CurrencyEnum;
      const paymentMethodKey = rate.paymentMethodId as PaymentMethodEnum;
      const key = `${currencyKey}:${paymentMethodKey}`;
      if (!grouped.has(key)) {
        grouped.set(key, { currencyKey, paymentMethodKey, rates: [] });
      }
      grouped.get(key)!.rates.push(rate);
    }

    try {
      const processedGroups: { type: string; rate: number }[] = [];

      const processedCount = await this.prisma.$transaction(async (client) => {
        const currencyCache = new Map<CurrencyEnum, { id: string }>();
        const paymentMethodCache = new Map<PaymentMethodEnum, { id: string }>();
        let affected = 0;

        for (const {
          currencyKey,
          paymentMethodKey,
          rates,
        } of grouped.values()) {
          if (!currencyCache.has(currencyKey)) {
            const currency = await client.currency.findUnique({
              where: { name: currencyKey },
              select: { id: true },
            });
            if (!currency) {
              console.warn(`Currency ${currencyKey} not found. Skipping.`);
              continue;
            }
            currencyCache.set(currencyKey, currency);
          }

          if (!paymentMethodCache.has(paymentMethodKey)) {
            const paymentMethod = await client.paymentMethod.findUnique({
              where: { nameEn: paymentMethodKey },
              select: { id: true },
            });
            if (!paymentMethod) {
              console.warn(
                `Payment method ${paymentMethodKey} not found. Skipping.`,
              );
              continue;
            }
            paymentMethodCache.set(paymentMethodKey, paymentMethod);
          }

          const currency = currencyCache.get(currencyKey);
          const paymentMethod = paymentMethodCache.get(paymentMethodKey);
          if (!currency || !paymentMethod) {
            continue;
          }

          // Remove existing rates for this currency/method pair before inserting new ones
          await client.rates.deleteMany({
            where: {
              currencyId: currency.id,
              paymentMethodId: paymentMethod.id,
            },
          });

          // Sort rates to ensure consistent "middle" selection
          // We'll sort by minAmount descending (highest amounts first, same as displayed)
          const sortedRates = [...rates].sort((a, b) => b.minAmount - a.minAmount);
          const middleIndex = Math.floor(sortedRates.length / 2);
          const middleRate = sortedRates[middleIndex];

          if (middleRate) {
            processedGroups.push({
              type: `${paymentMethodKey}_${currencyKey}`,
              rate: middleRate.rate,
            });
          }

          const xml = XML_MAP[`${paymentMethodKey}_${currencyKey}`] || null;

          for (const rate of rates) {
            await client.rates.create({
              data: {
                rate: rate.rate,
                minAmount: rate.minAmount,
                maxAmount: rate.maxAmount ?? 0,
                currencyId: currency.id,
                paymentMethodId: paymentMethod.id,
                enabled: rate.enabled,
                xml,
              },
            });
            affected += 1;
          }
        }

        console.log(`Rates processed: ${affected}`);
        return affected;
      });

      return processedCount > 0;
    } catch (error) {
      throw new Error(
        `Failed to create rates: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
  async sendAllRatesToAllVendors(ctx: Context) {
    const allRates = await this.utilsService.getAllPublicRatesMarkupMessage();
    const allVendors = await this.vendorService.getAllActiveVendors();
    if (allVendors.length === 0) {
      return;
    }
    for (const vendor of allVendors) {
      try {
        if (!vendor.work) {
          console.log(`Vendor ${vendor.id} is on pause, skipping...`);
          continue;
        }
        if (vendor.lastAllRateMessageId == null) {
          const msg = await ctx.telegram.sendMessage(
            Number(vendor.chatId),
            allRates,
            { parse_mode: 'HTML' },
          );
          await this.vendorService.updateAllRatesLastMessageId(
            vendor.id,
            msg.message_id,
          );
        } else {
          try {
            await ctx.telegram.deleteMessage(
              Number(vendor.chatId),
              Number(vendor.lastAllRateMessageId),
            );
            const msg = await ctx.telegram.sendMessage(
              Number(vendor.chatId),
              allRates,
              { parse_mode: 'HTML' },
            );
            await this.vendorService.updateAllRatesLastMessageId(
              vendor.id,
              msg.message_id,
            );
          } catch (error) {
            console.error(
              `Failed to edit message for vendor ${vendor.id}:`,
              error,
            );
            const msg = await ctx.telegram.sendMessage(
              Number(vendor.chatId),
              allRates,
              { parse_mode: 'HTML' },
            );
            await this.vendorService.updateAllRatesLastMessageId(
              vendor.id,
              msg.message_id,
            );
          }
        }
      } catch (error) {
        console.error(`Failed to send rates to vendor ${vendor.id}:`, error);
      }
    }
  }
}
