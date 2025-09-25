import { PaymentMethodEnum } from '@prisma/client';
import { UtilsService } from 'src/modules/utils/utils.service';
import { FullRequestType } from 'src/types/types';
import {
  KztBaseStrategy,
  KztStrategyDependencies,
  CreateRequestParams,
  ParsedStrategyInput,
} from './kzt-base.strategy';

interface KztCardParsedInput extends ParsedStrategyInput {
  cardNumber: string;
  holderName?: string;
}

export class KztCardStrategy extends KztBaseStrategy {
  private readonly cardRegex = /^(?:\d{12,19})$/;

  constructor(
    deps: KztStrategyDependencies & { utilsService: UtilsService },
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
    const parsed: KztCardParsedInput[] = [];

    for (const line of rows) {
      const tokens = line
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

      parsed.push({ amount, cardNumber, holderName });
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
  }: CreateRequestParams & { parsed: KztCardParsedInput }): Promise<FullRequestType> {
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
          comment: parsed.holderName ? `Holder: ${parsed.holderName}` : null,
          bankId: bankName?.id ?? null,
          blackListId: blackListEntry?.id ?? null,
        },
      },
    });

    return request as unknown as FullRequestType;
  }

  protected buildDetails(data: KztCardParsedInput): string {
    const lines = [
      'Тип: KZT CARD',
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
