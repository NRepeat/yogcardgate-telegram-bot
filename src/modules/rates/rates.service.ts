import { Injectable, Inject, forwardRef } from '@nestjs/common';

import { ParsedMessageRates, SerializedRate } from 'src/types/types';
import RateRepository from './rates.repo';
import { Context } from 'telegraf';
import Rate from 'src/model/Rate';
import { VendorService } from '../vendor/vendor.service';
import { PrismaService } from '../prisma/prisma.service';
import { CurrencyEnum, PaymentMethodEnum } from '@prisma/client';
import { UtilsService } from '../utils/utils.service';

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

  async getAllRatesMarkupMessage() {
    const allRates = await this.getAllRates();
    type MethodRates = {
      minAmount: number;
      maxAmount: number | null;
      rate: number;
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
        const header = `${group.displayName}:${methodKey}`;
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
          message.push(`${amount} ${r.rate}`);
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
      const method = parsedRate.header.split(':')[1].trim();
      const paymentMethodId =
        PaymentMethodEnum[method as keyof typeof PaymentMethodEnum];
      const currencyName = parsedRate.header.split(':')[0].trim();
      const currencyId =
        CurrencyEnum[currencyName as keyof typeof CurrencyEnum];
      for (const line of parsedRate.lines) {
        let minAmount = 0;
        let maxAmount: number | null = null;
        let rate = 0;
        const [amountPart, ratePart] = line.split(' ');
        rate = Number(ratePart);
        if (amountPart.includes('+')) {
          minAmount = Number(amountPart.replace('+', ''));
          maxAmount = null;
        } else if (amountPart.includes('-')) {
          const [min, max] = amountPart.split('-');
          minAmount = Number(min);
          maxAmount = Number(max);
        }
        const newRate = new Rate(
          rate,
          minAmount,
          maxAmount ?? 0,
          currencyId,
          paymentMethodId,
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
      const processedCount = await this.prisma.$transaction(async (client) => {
        const currencyCache = new Map<CurrencyEnum, { id: string }>();
        const paymentMethodCache = new Map<
          PaymentMethodEnum,
          { id: string }
        >();
        let affected = 0;

        for (const { currencyKey, paymentMethodKey, rates } of grouped.values()) {
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

          for (const rate of rates) {
            await client.rates.create({
              data: {
                rate: rate.rate,
                minAmount: rate.minAmount,
                maxAmount: rate.maxAmount ?? 0,
                currencyId: currency.id,
                paymentMethodId: paymentMethod.id,
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
