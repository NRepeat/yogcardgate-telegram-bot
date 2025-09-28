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

    if (lines.length < 2) {
      return {
        success: false as const,
        error: 'Укажите номер карты, сумму и ФИО на китайском. Формат: Номер карты - Сумма\nФИО на китайском',
      };
    }

    const cardDataLine = lines[0];
    const holderName = lines[1];

    // Parse card number and amount from first line
    const cardAmountMatch = cardDataLine.match(/^(\d+)\s+(\d+(?:\.\d+)?)$/);
    if (!cardAmountMatch) {
      return {
        success: false as const,
        error: 'Неверный формат. Используйте: Номер карты - Сумма',
      };
    }

    const cardNumber = cardAmountMatch[1];
    const amount = parseFloat(cardAmountMatch[2]);

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
          comment: `Bank: Chinese Bank\nHolder: ${parsed.holderName}`,
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
