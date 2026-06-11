import { PaymentMethodEnum } from '@prisma/client';
import { UtilsService } from 'src/modules/utils/utils.service';
import { FullRequestType } from 'src/types/types';
import {
  AznBaseStrategy,
  AznStrategyDependencies,
  CreateRequestParams,
  ParsedStrategyInput,
} from './azn-base.strategy';

interface AznCardParsedInput extends ParsedStrategyInput {
  cardNumber: string;
  holderName?: string;
  bank?: string;
}

export class AznCardStrategy extends AznBaseStrategy {
  private readonly cardRegex = /^(?:\d{12,19})$/;
  protected readonly methodEnum: PaymentMethodEnum = PaymentMethodEnum.CARD;
  protected readonly typeLabel: string = 'AZN CARD';

  constructor(deps: AznStrategyDependencies & { utilsService: UtilsService }) {
    super(deps);
    this.utilsService = deps.utilsService;
  }

  private readonly utilsService: UtilsService;

  protected supportsMethod(method: PaymentMethodEnum): boolean {
    return method === this.methodEnum;
  }

  protected parseInput(message: string) {
    const lines = message
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    // First line: card number + amount + holder name
    const firstLine = lines[0] || message.trim();
    const tokens = firstLine
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
        error:
          'Не удалось найти номер карты. Убедитесь, что указали его полностью.',
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

    const holderTokens = remaining.filter(
      (_, index) => index !== amountTokenIndex,
    );
    const holderName = holderTokens.join(' ').trim() || undefined;

    // Second line (if exists): bank name
    const bank = lines[1] || undefined;

    return {
      success: true as const,
      data: [{ amount, cardNumber, holderName, bank }],
    };
  }

  protected async createRequest({
    currencyId,
    vendorId,
    rate,
    parsed,
  }: CreateRequestParams & {
    parsed: AznCardParsedInput;
  }): Promise<FullRequestType> {
    const blackListEntry = await this.deps.requestService.isInBlackList(
      parsed.cardNumber,
    );

    // Build comment parts
    const commentParts: string[] = [];
    if (parsed.holderName) {
      commentParts.push(`Holder: ${parsed.holderName}`);
    }
    if (parsed.bank) {
      commentParts.push(`Bank: ${parsed.bank}`);
    }

    const request = await this.deps.requestService.createGeneralRequest({
      amount: parsed.amount,
      vendorId,
      currencyId,
      rateId: rate.id,
      rate: String(rate.rate ?? ''),
      method: {
        method: this.methodEnum,
        card: {
          card: parsed.cardNumber,
          comment: commentParts.length > 0 ? commentParts.join(', ') : null,
          bankId: null,
          blackListId: blackListEntry?.id ?? null,
        },
      },
    });

    return request as unknown as FullRequestType;
  }

  protected buildDetails(data: AznCardParsedInput): string {
    const lines = [
      `Тип: ${this.typeLabel}`,
      `Карта: <code>${data.cardNumber}</code>`,
      `Сумма: ${data.amount} AZN`,
    ];
    if (data.holderName) {
      lines.push(`Держатель: ${data.holderName}`);
    }
    if (data.bank) {
      lines.push(`Банк: ${data.bank}`);
    }
    return lines.join('\n');
  }

  private tryParseAmount(token: string): number | null {
    const normalized = token.replace(/[^0-9,\.]/g, '').replace(/,/g, '.');
    if (!normalized) {
      return null;
    }
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
  }
}
