import { PaymentMethodEnum } from '@prisma/client';
import { UtilsService } from 'src/modules/utils/utils.service';
import { FullRequestType } from 'src/types/types';
import {
  CreateRequestParams,
  ParsedStrategyInput,
  UahBaseStrategy,
  UahStrategyDependencies,
} from './uah-base.strategy';

interface UahCardParsedInput extends ParsedStrategyInput {
  cardNumber: string;
}

export class UahCardStrategy extends UahBaseStrategy {
  private readonly cardRegex = /^(?:\d{12,19})$/;

  constructor(
    deps: UahStrategyDependencies & { utilsService: UtilsService },
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
    const parsedItems: UahCardParsedInput[] = [];

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
  }: CreateRequestParams & { parsed: UahCardParsedInput }): Promise<FullRequestType> {
    const bankName =
      await this.utilsService.getBankNameByCardNumber(parsed.cardNumber);

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
          bankId: bankName?.id ?? null,
          blackListId: blackListEntry?.id ?? null,
        },
      },
    });

    return request as unknown as FullRequestType;
  }

  protected buildDetails(data: UahCardParsedInput): string {
    return [
      'Тип: UAH CARD',
      `Карта: <code>${data.cardNumber}</code>`,
      `Сумма: ${data.amount} UAH`,
    ].join('\n');
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
    | { success: true; data: UahCardParsedInput }
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

    const cardTokenIndex = tokens.findIndex((token) =>
      this.cardRegex.test(token.replace(/\D/g, '')),
    );

    if (cardTokenIndex === -1) {
      return {
        success: false,
        error: 'Не удалось найти номер карты. Проверьте формат 16 цифр без разделителей.',
      };
    }

    const cardCandidate = tokens[cardTokenIndex].replace(/\D/g, '');
    if (!this.cardRegex.test(cardCandidate)) {
      return {
        success: false,
        error: 'Неверный формат номера карты.',
      };
    }

    const amountTokenIndex = tokens.findIndex((token, index) => {
      if (index === cardTokenIndex) {
        return false;
      }
      const numeric = this.tryParseAmount(token);
      return numeric !== null && numeric > 0;
    });

    if (amountTokenIndex === -1) {
      return {
        success: false,
        error: 'Не удалось определить сумму перевода.',
      };
    }

    const amount = this.tryParseAmount(tokens[amountTokenIndex]);
    if (!amount || amount <= 0) {
      return {
        success: false,
        error: 'Сумма должна быть положительным числом.',
      };
    }

    return {
      success: true,
      data: {
        amount,
        cardNumber: cardCandidate,
      },
    };
  }
}
