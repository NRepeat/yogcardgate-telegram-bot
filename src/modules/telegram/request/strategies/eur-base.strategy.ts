import { CurrencyEnum, PaymentMethodEnum, Rates } from '@prisma/client';
import { RequestService } from 'src/modules/request/request.service';
import { RatesService } from 'src/modules/rates/rates.service';
import { VendorService } from 'src/modules/vendor/vendor.service';
import { CustomSceneContext, FullRequestType } from 'src/types/types';
import {
  PaymentRequestStrategy,
  StrategyExecuteContext,
  StrategyResult,
} from './payment-request.strategy';

export interface EurStrategyDependencies {
  ratesService: RatesService;
  requestService: RequestService;
  vendorService: VendorService;
}

export abstract class EurBaseStrategy implements PaymentRequestStrategy {
  protected readonly targetCurrency = CurrencyEnum.EUR;

  constructor(protected readonly deps: EurStrategyDependencies) {}

  supports(currency: CurrencyEnum, method: PaymentMethodEnum): boolean {
    return currency === this.targetCurrency && this.supportsMethod(method);
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

      const parsed = this.parseInput(context.message);
      if (!parsed.success) {
        return {
          status: 'error',
          error: parsed.error,
        };
      }

      const availableRates =
        (await this.deps.ratesService.getAllRates()) as RateWithRelations[];

      const requests: FullRequestType[] = [];
      const details: string[] = [];

      for (const parsedItem of parsed.data) {
        const rate = this.findRate(availableRates, parsedItem.amount, method);
        if (!rate) {
          return {
            status: 'error',
            error: 'Нет доступного курса для указанной суммы.',
          };
        }

        const request = await this.createRequest({
          ctx: context.ctx,
          method,
          currencyId: rate.currencyId,
          vendorId: vendor.id,
          rate,
          parsed: parsedItem,
        });

        requests.push(request as unknown as FullRequestType);
        details.push(this.buildDetails(parsedItem));
      }

      return {
        status: 'success',
        requests,
        details,
      };
    } catch (error) {
      console.error('[EUR Strategy] Unexpected error:', error);
      return {
        status: 'error',
        error: 'Не удалось создать заявку. Попробуйте ещё раз позже.',
      };
    }
  }

  protected async resolveVendor(ctx: CustomSceneContext) {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      return null;
    }
    return this.deps.vendorService.getVendorByChatId(chatId);
  }

  protected findRate(
    rates: RateWithRelations[],
    amount: number,
    method: PaymentMethodEnum,
  ) {
    return (
      rates.find((rate) => {
        if (
          rate.currency.name !== this.targetCurrency ||
          rate.paymentMethod.nameEn !== method
        ) {
          return false;
        }
        const minCheck = amount >= rate.minAmount;
        const maxLimit = rate.maxAmount === 0 || rate.maxAmount === null;
        const maxCheck = maxLimit || amount <= rate.maxAmount;
        return minCheck && maxCheck;
      }) ?? null
    );
  }

  protected abstract supportsMethod(method: PaymentMethodEnum): boolean;
  protected abstract parseInput(
    message: string,
  ): { success: true; data: ParsedStrategyInput[] } | { success: false; error: string };
  protected abstract createRequest(
    params: CreateRequestParams,
  ): Promise<FullRequestType>;
  protected abstract buildDetails(data: ParsedStrategyInput): string;
}

export interface ParsedStrategyInput {
  amount: number;
  extraChargePercent?: number;
  [key: string]: any;
}

export function tryParseExtraChargePercent(token: string): number | null {
  // Check if token contains percent sign
  if (!token.includes('%')) {
    return null;
  }

  // Extract numeric part
  const normalized = token
    .replace(/%/g, '')
    .replace(/[^0-9,\.]/g, '')
    .replace(/,/g, '.');

  if (!normalized) {
    return null;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  // Return as decimal (10% -> 0.10, 1% -> 0.01, 0.1% -> 0.001)
  return value / 100;
}

export function applyExtraCharge(baseRate: number, extraChargePercent?: number): number {
  if (!extraChargePercent || extraChargePercent <= 0) {
    return baseRate;
  }
  return baseRate * (1 + extraChargePercent);
}

export function formatRateForStorage(rate: number): string {
  // EUR rates need 3 decimal places to preserve precision (e.g., 0.841)
  return rate.toFixed(3);
}

export interface CreateRequestParams {
  ctx: CustomSceneContext;
  method: PaymentMethodEnum;
  currencyId: string;
  vendorId: string;
  rate: RateWithRelations;
  parsed: ParsedStrategyInput;
}

type RateWithRelations = Rates & {
  paymentMethod: { nameEn: PaymentMethodEnum };
  currency: { name: CurrencyEnum };
};
