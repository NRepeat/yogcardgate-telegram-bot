import { CurrencyEnum, PaymentMethodEnum, Rates } from '@prisma/client';
import { RequestService } from 'src/modules/request/request.service';
import { RatesService } from 'src/modules/rates/rates.service';
import { VendorService } from 'src/modules/vendor/vendor.service';
import { CustomSceneContext, FullRequestType } from 'src/types/types';
import { PaymentFormFactory } from '../payment-form.factory';
import {
  PaymentRequestStrategy,
  StrategyExecuteContext,
  StrategyResult,
} from './payment-request.strategy';

export interface GenericFormStrategyDependencies {
  ratesService: RatesService;
  requestService: RequestService;
  vendorService: VendorService;
}

const AMOUNT_LABEL = 'Сумма';

// Currencies whose request forms are fully described in PaymentFormFactory
// and need no dedicated parsing logic. Specific strategies always win because
// this strategy is registered last.
const GENERIC_CURRENCIES = new Set<CurrencyEnum>([
  CurrencyEnum.GBP,
  CurrencyEnum.SEK,
  CurrencyEnum.MDL,
  CurrencyEnum.AMD,
  CurrencyEnum.KGS,
  CurrencyEnum.BGN,
  CurrencyEnum.HUF,
  CurrencyEnum.GEL,
  CurrencyEnum.TJS,
  CurrencyEnum.INR,
  CurrencyEnum.IDR,
  CurrencyEnum.RON,
  CurrencyEnum.BRL,
  CurrencyEnum.ARS,
  CurrencyEnum.VND,
]);

type RateWithRelations = Rates & {
  paymentMethod: { nameEn: PaymentMethodEnum };
  currency: { name: CurrencyEnum };
};

export class GenericFormStrategy implements PaymentRequestStrategy {
  constructor(protected readonly deps: GenericFormStrategyDependencies) {}

  supports(currency: CurrencyEnum, method: PaymentMethodEnum): boolean {
    return (
      GENERIC_CURRENCIES.has(currency) &&
      PaymentFormFactory.getForm(currency, method) !== null
    );
  }

  async execute(
    method: PaymentMethodEnum,
    context: StrategyExecuteContext,
  ): Promise<StrategyResult> {
    try {
      const vendor = await this.resolveVendor(context.ctx);
      if (!vendor) {
        return {
          status: 'error',
          error:
            'Не удалось определить вендора. Пожалуйста, зарегистрируйте чат как рабочий.',
        };
      }

      const currencyName = context.currency.name;
      const form = PaymentFormFactory.getForm(currencyName, method);
      if (!form) {
        return {
          status: 'error',
          error: 'Форма для этого направления не настроена.',
        };
      }

      const lines = context.message
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      const requiredCount = form.fields.filter((f) => !f.optional).length;
      if (lines.length < requiredCount) {
        const expected = form.fields
          .filter((f) => !f.optional)
          .map((f) => f.label)
          .join(', ');
        return {
          status: 'error',
          error: `Нужно указать (каждое с новой строки): ${expected}.`,
        };
      }

      let amount: number | null = null;
      const fieldValues: Record<string, string> = {};

      for (let i = 0; i < form.fields.length && i < lines.length; i++) {
        const field = form.fields[i];
        const value = lines[i];
        if (field.label === AMOUNT_LABEL) {
          amount = this.tryParseAmount(value);
          if (!amount || amount <= 0) {
            return {
              status: 'error',
              error: 'Сумма должна быть положительным числом.',
            };
          }
        } else {
          fieldValues[field.label] = value;
        }
      }

      if (amount === null) {
        return {
          status: 'error',
          error: 'Не удалось определить сумму.',
        };
      }

      const availableRates =
        (await this.deps.ratesService.getAllEnabledRates()) as RateWithRelations[];
      const rate = this.findRate(availableRates, currencyName, method, amount);
      if (!rate) {
        return {
          status: 'error',
          error: 'Нет доступного курса для указанной суммы.',
        };
      }

      const request = await this.deps.requestService.createGeneralRequest({
        amount,
        vendorId: vendor.id,
        currencyId: rate.currencyId,
        rateId: rate.id,
        rate: String(rate.rate ?? ''),
        method: {
          method,
          generic: fieldValues,
        },
      });

      return {
        status: 'success',
        requests: [request as unknown as FullRequestType],
        details: [
          this.buildDetails(form.title, currencyName, amount, fieldValues),
        ],
      };
    } catch (error) {
      console.error('GenericFormStrategy error:', error);
      return {
        status: 'error',
        error: 'Не удалось создать заявку. Попробуйте ещё раз.',
      };
    }
  }

  private buildDetails(
    title: string,
    currency: CurrencyEnum,
    amount: number,
    fieldValues: Record<string, string>,
  ): string {
    const lines = [`Тип: ${currency} ${title}`];
    for (const [label, value] of Object.entries(fieldValues)) {
      lines.push(`${label}: <code>${value}</code>`);
    }
    lines.push(`Сумма: ${amount} ${currency}`);
    return lines.join('\n');
  }

  private findRate(
    rates: RateWithRelations[],
    currency: CurrencyEnum,
    method: PaymentMethodEnum,
    amount: number,
  ) {
    return (
      rates.find((rate) => {
        if (
          rate.currency.name !== currency ||
          rate.paymentMethod.nameEn !== method
        ) {
          return false;
        }
        const minCheck = amount >= rate.minAmount;
        const noMax = rate.maxAmount === 0 || rate.maxAmount === null;
        const maxCheck = noMax || amount <= rate.maxAmount;
        return minCheck && maxCheck;
      }) ?? null
    );
  }

  private resolveVendor(ctx: CustomSceneContext) {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      return null;
    }
    return this.deps.vendorService.getVendorByChatId(chatId);
  }

  private tryParseAmount(raw: string): number | null {
    const normalized = raw.replace(/[^\d,\.]/g, '').replace(/,/g, '.');
    if (!normalized) {
      return null;
    }
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
  }
}
