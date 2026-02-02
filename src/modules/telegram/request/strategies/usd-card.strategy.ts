import { PaymentMethodEnum } from '@prisma/client';
import { UtilsService } from 'src/modules/utils/utils.service';
import { FullRequestType } from 'src/types/types';
import {
  CreateRequestParams,
  ParsedStrategyInput,
  UsdBaseStrategy,
  UsdStrategyDependencies,
  tryParseExtraChargePercent,
  applyExtraCharge,
  formatRateForStorage,
} from './usd-base.strategy';

interface UsdCardParsedInput extends ParsedStrategyInput {
  cardNumber: string;
  holderName?: string;
  extraChargePercent?: number;
}

export class UsdCardStrategy extends UsdBaseStrategy {
  private readonly cardRegex =
    /^(?:4[0-9]{12}(?:[0-9]{3})?|[25][1-7][0-9]{14}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11})$/;

  constructor(
    deps: UsdStrategyDependencies & { utilsService: UtilsService },
  ) {
    super(deps);
    this.utilsService = deps.utilsService;
  }

  private readonly utilsService: UtilsService;

  protected supportsMethod(method: PaymentMethodEnum): boolean {
    return method === PaymentMethodEnum.CARD;
  }

  protected parseInput(message: string) {
    const lines = message
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const segments = lines.length > 0 ? lines : [message.trim()];
    const parsedItems: UsdCardParsedInput[] = [];

    for (const line of segments) {
      const parsed = this.parseLine(line);
      if (!parsed.success) {
        return parsed;
      }
      parsedItems.push(parsed.data);
    }

    if (parsedItems.length === 0) {
      return {
        success: false as const,
        error: 'Укажите номер карты и сумму через пробел.',
      };
    }

    return {
      success: true as const,
      data: parsedItems,
    };
  }

  protected async createRequest({
    currencyId,
    vendorId,
    rate,
    parsed,
  }: CreateRequestParams & { parsed: UsdCardParsedInput }): Promise<FullRequestType> {
    const bankName =
      await this.utilsService.getBankNameByCardNumber(parsed.cardNumber);
    const holderComment =
      parsed.holderName && parsed.holderName.trim().length > 0
        ? `Holder: ${parsed.holderName.trim()}`
        : 'Card request created via bot';

    const blackListEntry =
      await this.deps.requestService.isInBlackList(parsed.cardNumber);

    // Apply extra charge if provided
    const finalRate = applyExtraCharge(rate.rate ?? 0, parsed.extraChargePercent);

    const request = await this.deps.requestService.createGeneralRequest({
      amount: parsed.amount,
      vendorId,
      currencyId,
      rateId: rate.id,
      rate: formatRateForStorage(finalRate),
      method: {
        method: PaymentMethodEnum.CARD,
        card: {
          card: parsed.cardNumber,
          comment: holderComment,
          bankId: bankName?.id ?? null,
          blackListId: blackListEntry?.id ?? null,
        },
      },
    });

    return request as unknown as FullRequestType;
  }

  protected buildDetails(data: UsdCardParsedInput): string {
    const lines = [
      'Тип: USD CARD',
      `Карта: <code>${data.cardNumber}</code>`,
      `Сумма: ${data.amount} USD`,
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

  private parseLine(
    line: string,
  ):
    | { success: true; data: UsdCardParsedInput }
    | { success: false; error: string } {
    const tokens = line
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);

    if (tokens.length === 0) {
      return {
        success: false,
        error: 'Укажите номер карты и сумму через пробел.',
      };
    }

    const cardIndex = tokens.findIndex((token) =>
      /^(?:\d{12,19})$/.test(token.replace(/\s+/g, '')),
    );

    if (cardIndex === -1) {
      return {
        success: false,
        error: 'Не удалось найти номер карты. Убедитесь, что указали его полностью.',
      };
    }

    const cardNumber = tokens[cardIndex].replace(/\s+/g, '');
    if (!this.cardRegex.test(cardNumber)) {
      return {
        success: false,
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
        success: false,
        error: 'Не удалось определить сумму перевода.',
      };
    }

    const amount = this.tryParseAmount(remaining[amountTokenIndex]);
    if (!amount || amount <= 0) {
      return {
        success: false,
        error: 'Сумма перевода должна быть положительным числом.',
      };
    }

    // Look for extra charge percent (10%, 1%, 0.1%)
    let extraChargePercent: number | undefined;
    const percentTokenIndex = remaining.findIndex((token) => token.includes('%'));
    if (percentTokenIndex !== -1) {
      const percentValue = tryParseExtraChargePercent(remaining[percentTokenIndex]);
      if (percentValue !== null && percentValue > 0) {
        extraChargePercent = percentValue;
      }
    }

    const holderTokens = remaining
      .filter((_, index) => index !== amountTokenIndex && index !== percentTokenIndex)
      .filter((token) => !/^USD$/i.test(token) && !token.includes('%'));
    const holderName = holderTokens.join(' ').trim() || undefined;

    return {
      success: true,
      data: {
        amount,
        cardNumber,
        holderName,
        extraChargePercent,
      },
    };
  }
}
