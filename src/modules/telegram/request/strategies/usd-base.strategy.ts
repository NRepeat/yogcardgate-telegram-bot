import { CurrencyEnum, PaymentMethodEnum, Rates } from '@prisma/client';
import { RequestService } from 'src/modules/request/request.service';
import { RatesService } from 'src/modules/rates/rates.service';
import { VendorService } from 'src/modules/vendor/vendor.service';
import { CustomSceneContext, FullRequestType } from 'src/types/types';
import { PaymentRequestStrategy, StrategyExecuteContext, StrategyResult } from './payment-request.strategy';

export interface UsdStrategyDependencies {
  ratesService: RatesService;
  requestService: RequestService;
  vendorService: VendorService;
}

export abstract class UsdBaseStrategy implements PaymentRequestStrategy {
  protected readonly targetCurrency = CurrencyEnum.USD;

  constructor(protected readonly deps: UsdStrategyDependencies) {}

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

      const rate = await this.findRate(parsed.data.amount, method);
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
        parsed: parsed.data,
      });

      return {
        status: 'success',
        request: request as unknown as FullRequestType,
        details: this.buildDetails(parsed.data),
      };
    } catch (error) {
      console.error('[USD Strategy] Unexpected error:', error);
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

  protected async findRate(amount: number, method: PaymentMethodEnum) {
    const allRates = await this.deps.ratesService.getAllRates();
    return (
      allRates.find((rate) => {
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
  ): { success: true; data: ParsedStrategyInput } | { success: false; error: string };
  protected abstract createRequest(params: CreateRequestParams): Promise<FullRequestType>;
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
  rate: Rates & { paymentMethod: { nameEn: PaymentMethodEnum }; currency: { name: CurrencyEnum } };
  parsed: ParsedStrategyInput;
}
