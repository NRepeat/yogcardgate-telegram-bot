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

export interface AedStrategyDependencies {
  ratesService: RatesService;
  requestService: RequestService;
  vendorService: VendorService;
}

export abstract class AedBaseStrategy implements PaymentRequestStrategy {
  protected readonly targetCurrency = CurrencyEnum.AED;

  constructor(protected readonly deps: AedStrategyDependencies) {}

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

      const rates = (await this.deps.ratesService.getAllEnabledRates()) as RateWithRelations[];
      const requests: FullRequestType[] = [];
      const details: string[] = [];

      for (const parsedItem of parsed.data) {
        const rate = this.findRate(rates, parsedItem.amount, method);
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
      console.error('[AED Strategy] Unexpected error:', error);
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
  [key: string]: any;
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
