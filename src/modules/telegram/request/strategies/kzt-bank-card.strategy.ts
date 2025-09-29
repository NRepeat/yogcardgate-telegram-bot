import { PaymentMethodEnum } from '@prisma/client';
import { UtilsService } from 'src/modules/utils/utils.service';
import { FullRequestType } from 'src/types/types';
import {
  KztBaseStrategy,
  KztStrategyDependencies,
  CreateRequestParams,
  ParsedStrategyInput,
  RateWithRelations,
} from './kzt-base.strategy';
import { StrategyExecuteContext, StrategyResult } from './payment-request.strategy';

export enum KztBankType {
  KASPI_BANK = 'Kaspi Bank',
  OTHER_BANKS = 'Остальные банки',
}

interface KztBankCardParsedInput extends ParsedStrategyInput {
  cardNumber: string;
  holderName?: string;
}

export class KztBankCardStrategy extends KztBaseStrategy {
  private readonly cardRegex = /^(?:\d{12,19})$/;
  private readonly bankTypeRegex = /^(Kaspi Bank|Остальные банки)$/i;

  constructor(
    deps: KztStrategyDependencies & { utilsService: UtilsService },
  ) {
    super(deps);
    this.utilsService = deps.utilsService;
  }

  private readonly utilsService: UtilsService;

  protected supportsMethod(method: PaymentMethodEnum): boolean {
    return method === PaymentMethodEnum.CARD || 
           method === PaymentMethodEnum.KZT_KASPI_BANK || 
           method === PaymentMethodEnum.KZT_OTHER_BANKS;
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

      const parsed = this.parseInput(context.message, context.ctx);
      if (!parsed.success) {
        return {
          status: 'error',
          error: parsed.error,
        };
      }

      const rates = (await this.deps.ratesService.getAllRates()) as RateWithRelations[];
      const requests: FullRequestType[] = [];
      const details: string[] = [];

      for (const parsedItem of parsed.data) {
        // Use the method from context
        const correctMethod = context.method;
        const rate = this.findRate(rates, parsedItem.amount, correctMethod);
        if (!rate) {
          return {
            status: 'error',
            error: 'Нет доступного курса для указанной суммы.',
          };
        }

        const request = await this.createRequest({
          ctx: context.ctx,
          method: correctMethod,
          currencyId: rate.currencyId,
          vendorId: vendor.id,
          rate,
          parsed: parsedItem,
        });

        requests.push(request as unknown as FullRequestType);
        details.push(this.buildDetails(parsedItem, correctMethod));
      }

      return {
        status: 'success',
        requests,
        details,
      };
    } catch (error) {
      console.error('[KZT Bank Strategy] Unexpected error:', error);
      return {
        status: 'error',
        error: 'Не удалось создать заявку. Попробуйте ещё раз позже.',
      };
    }
  }

  protected parseInput(message: string, context?: any) {
    // Parse card data from message
    const cardDataLine = message;
    const tokens = cardDataLine
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);

    if (!tokens.length) {
      return {
        success: false as const,
        error: 'Укажите номер карты и сумму через пробел.',
      };
    }

    const cardIndex = tokens.findIndex((token) =>
      this.cardRegex.test(token.replace(/\s+/g, '')),
    );

    if (cardIndex === -1) {
      return {
        success: false as const,
        error: 'Не удалось найти номер карты. Убедитесь, что указали его полностью.',
      };
    }

    const cardNumber = tokens[cardIndex].replace(/\s+/g, '');
    if (!this.cardRegex.test(cardNumber)) {
      return {
        success: false as const,
        error: 'Неверный формат номера карты.',
      };
    }

    const remaining = [
      ...tokens.slice(0, cardIndex),
      ...tokens.slice(cardIndex + 1),
    ];

    const amountTokenIndex = remaining.findIndex((token) => {
      const numeric = this.tryParseAmount(token);
      return numeric !== null && numeric > 0;
    });

    if (amountTokenIndex === -1) {
      return {
        success: false as const,
        error: 'Не удалось определить сумму перевода.',
      };
    }

    const amount = this.tryParseAmount(remaining[amountTokenIndex]);
    if (!amount || amount <= 0) {
      return {
        success: false as const,
        error: 'Сумма перевода должна быть положительным числом.',
      };
    }

    const holderTokens = remaining.filter((_, index) => index !== amountTokenIndex);
    const holderName = holderTokens.join(' ').trim() || undefined;

    return {
      success: true as const,
      data: [{ amount, cardNumber, holderName }],
    };
  }

  protected async createRequest({
    currencyId,
    vendorId,
    rate,
    parsed,
    method,
  }: CreateRequestParams & { parsed: KztBankCardParsedInput }): Promise<FullRequestType> {
    // Determine bank type based on method
    const bankType = method === PaymentMethodEnum.KZT_KASPI_BANK 
      ? KztBankType.KASPI_BANK 
      : KztBankType.OTHER_BANKS;

    const blackListEntry =
      await this.deps.requestService.isInBlackList(parsed.cardNumber);

    const request = await this.deps.requestService.createGeneralRequest({
      amount: parsed.amount,
      vendorId,
      currencyId,
      rateId: rate.id,
      rate: String(rate.rate),
      method: {
        method: method,
        card: {
          card: parsed.cardNumber,
          comment: parsed.holderName 
            ? `Holder: ${parsed.holderName}, Bank: ${bankType}` 
            : `Bank: ${bankType}`,
          bankId: null,
          blackListId: blackListEntry?.id ?? null,
        },
      },
    });

    return request as unknown as FullRequestType;
  }

  protected buildDetails(data: KztBankCardParsedInput, method?: PaymentMethodEnum): string {
    const bankType = method === PaymentMethodEnum.KZT_KASPI_BANK 
      ? KztBankType.KASPI_BANK 
      : KztBankType.OTHER_BANKS;
      
    const lines = [
      'Тип: KZT CARD',
      `Банк: ${bankType}`,
      `Карта: <code>${data.cardNumber}</code>`,
      `Сумма: ${data.amount} KZT`,
    ];
    if (data.holderName) {
      lines.push(`Держатель: ${data.holderName}`);
    }
    return lines.join('\n');
  }

  private tryParseAmount(token: string): number | null {
    const normalized = token
      .replace(/[^0-9,\.]/g, '')
      .replace(/,/g, '.');
    if (!normalized) {
      return null;
    }
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
  }
}
