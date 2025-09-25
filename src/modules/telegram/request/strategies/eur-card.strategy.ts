import { PaymentMethodEnum } from '@prisma/client';
import { UtilsService } from 'src/modules/utils/utils.service';
import { FullRequestType } from 'src/types/types';
import {
  CreateRequestParams,
  ParsedStrategyInput,
  EurBaseStrategy,
  EurStrategyDependencies,
} from './eur-base.strategy';

interface EurCardParsedInput extends ParsedStrategyInput {
  cardNumber: string;
  holderName?: string;
}

export class EurCardStrategy extends EurBaseStrategy {
  private readonly cardRegex =
    /^(?:4[0-9]{12}(?:[0-9]{3})?|[25][1-7][0-9]{14}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11})$/;

  constructor(
    deps: EurStrategyDependencies & { utilsService: UtilsService },
  ) {
    super(deps);
    this.utilsService = deps.utilsService;
  }

  private readonly utilsService: UtilsService;

  protected supportsMethod(method: PaymentMethodEnum): boolean {
    return method === PaymentMethodEnum.CARD;
  }

  protected parseInput(message: string) {
    const segments = message
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const rows = segments.length ? segments : [message.trim()];
    const parsed: EurCardParsedInput[] = [];

    for (const line of rows) {
      const result = this.parseLine(line);
      if (!result.success) {
        return result;
      }
      parsed.push(result.data);
    }

    if (parsed.length === 0) {
      return {
        success: false as const,
        error: 'Укажите номер карты и сумму через пробел.',
      };
    }

    return {
      success: true as const,
      data: parsed,
    };
  }

  protected async createRequest({
    currencyId,
    vendorId,
    rate,
    parsed,
  }: CreateRequestParams & { parsed: EurCardParsedInput }): Promise<FullRequestType> {
    const bankName =
      await this.utilsService.getBankNameByCardNumber(parsed.cardNumber);
    const holderComment =
      parsed.holderName && parsed.holderName.trim().length > 0
        ? `Holder: ${parsed.holderName.trim()}`
        : 'EUR card request created via bot';

    const blackListEntry =
      await this.deps.requestService.isInBlackList(parsed.cardNumber);

    const request = await this.deps.requestService.createGeneralRequest({
      amount: parsed.amount,
      vendorId,
      currencyId,
      rateId: rate.id,
      rate: String(rate.rate ?? ''),
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

  protected buildDetails(data: EurCardParsedInput): string {
    const lines = [
      'Тип: EUR CARD',
      `Карта: <code>${data.cardNumber}</code>`,
      `Сумма: ${data.amount} EUR`,
    ];
    if (data.holderName) {
      lines.push(`Держатель: ${data.holderName}`);
    }
    return lines.join('\n');
  }

  private parseLine(
    line: string,
  ):
    | { success: true; data: EurCardParsedInput }
    | { success: false; error: string } {
    const tokens = line
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);

    if (!tokens.length) {
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

    const amountIndex = remaining.findIndex((token) => {
      const numeric = this.tryParseAmount(token);
      return numeric !== null && numeric > 0;
    });

    if (amountIndex === -1) {
      return {
        success: false,
        error: 'Не удалось определить сумму.',
      };
    }

    const amount = this.tryParseAmount(remaining[amountIndex]);
    if (!amount || amount <= 0) {
      return {
        success: false,
        error: 'Сумма должна быть положительным числом.',
      };
    }

    const holderTokens = remaining
      .filter((_, index) => index !== amountIndex)
      .filter((token) => !/^EUR$/i.test(token));
    const holderName = holderTokens.join(' ').trim() || undefined;

    return {
      success: true,
      data: {
        amount,
        cardNumber,
        holderName,
      },
    };
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
