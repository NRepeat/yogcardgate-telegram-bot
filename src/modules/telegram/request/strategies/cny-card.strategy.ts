import { PaymentMethodEnum } from '@prisma/client';
import { FullRequestType } from 'src/types/types';
import {
  CnyBaseStrategy,
  CnyStrategyDependencies,
  CreateRequestParams,
  ParsedStrategyInput,
} from './cny-base.strategy';

interface CnyCardParsedInput extends ParsedStrategyInput {
  cardNumber: string;
  holderName: string;
}

export class CnyCardStrategy extends CnyBaseStrategy {
  constructor(deps: CnyStrategyDependencies) {
    super(deps);
  }

  protected supportsMethod(method: PaymentMethodEnum): boolean {
    return method === PaymentMethodEnum.CNY_CARD;
  }

  protected parseInput(message: string) {
    const lines = message
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    let cardNumber: string;
    let amount: number;
    let holderName: string;

    if (lines.length === 1) {
      // Single line format: "4000000012345678 3000 张三"
      const singleLineMatch = lines[0].match(/^(\d+)\s+(\d+(?:\.\d+)?)\s+(.+)$/);
      if (!singleLineMatch) {
        return {
          success: false as const,
          error: 'Неверный формат. Используйте: Номер карты Сумма ФИО на китайском',
        };
      }
      cardNumber = singleLineMatch[1];
      amount = parseFloat(singleLineMatch[2]);
      holderName = singleLineMatch[3];
    } else if (lines.length >= 2) {
      // Two line format: "4000000012345678 3000" on first line, "张三" on second line
      const cardDataLine = lines[0];
      holderName = lines[1];

      const cardAmountMatch = cardDataLine.match(/^(\d+)\s+(\d+(?:\.\d+)?)$/);
      if (!cardAmountMatch) {
        return {
          success: false as const,
          error: 'Неверный формат первой строки. Используйте: Номер карты Сумма',
        };
      }
      cardNumber = cardAmountMatch[1];
      amount = parseFloat(cardAmountMatch[2]);
    } else {
      return {
        success: false as const,
        error: 'Укажите номер карты, сумму и ФИО на китайском. Формат: Номер карты Сумма ФИО на китайском',
      };
    }

    if (!cardNumber || cardNumber.length < 16) {
      return {
        success: false as const,
        error: 'Номер карты должен содержать минимум 16 цифр.',
      };
    }

    if (!amount || amount <= 0) {
      return {
        success: false as const,
        error: 'Сумма должна быть положительным числом.',
      };
    }

    if (!holderName || holderName.length < 2) {
      return {
        success: false as const,
        error: 'Укажите ФИО на китайском языке.',
      };
    }

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
  }: CreateRequestParams & { parsed: CnyCardParsedInput }): Promise<FullRequestType> {
    const request = await this.deps.requestService.createGeneralRequest({
      amount: parsed.amount,
      vendorId,
      currencyId,
      rateId: rate.id,
      rate: String(rate.rate ?? ''),
      method: {
        method: PaymentMethodEnum.CNY_CARD,
        card: {
          card: parsed.cardNumber,
          holder: parsed.holderName,
          comment: 'Bank: Chinese Bank',
          bankId: null,
        },
      },
    });

    return request as unknown as FullRequestType;
  }

  protected buildDetails(data: CnyCardParsedInput): string {
    const lines = [
      'Тип: CNY Card',
      `Номер карты: ${data.cardNumber}`,
      `ФИО: ${data.holderName}`,
      `Сумма: ${data.amount} CNY`,
    ];
    return lines.join('\n');
  }
}
