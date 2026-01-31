import { PaymentMethodEnum } from '@prisma/client';
import { FullRequestType } from 'src/types/types';
import {
  CreateRequestParams,
  ParsedStrategyInput,
  EurBaseStrategy,
  EurStrategyDependencies,
} from './eur-base.strategy';

interface EurWiseParsedInput extends ParsedStrategyInput {
  email: string;
  fullName: string;
  cardNumber?: string;
  rawAmountToken: string;
  comment?: string;
}

export class EurWiseStrategy extends EurBaseStrategy {
  constructor(deps: EurStrategyDependencies) {
    super(deps);
  }

  protected supportsMethod(method: PaymentMethodEnum): boolean {
    return method === PaymentMethodEnum.WIZE;
  }

  protected parseInput(message: string) {
    const lines = message
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 3) {
      return {
        success: false as const,
        error:
          'Ожидались минимум три строки: email, ФИО и сумма.',
      };
    }

    const email = lines[0];
    if (!this.isValidEmail(email)) {
      return {
        success: false as const,
        error: 'Некорректный email. Проверьте формат.',
      };
    }

    const fullName = lines[1];
    if (!fullName || fullName.length < 3) {
      return {
        success: false as const,
        error: 'Укажите корректное ФИО.',
      };
    }

    // Check if line 2 is a card number (16+ digits) or amount
    let cardNumber: string | undefined;
    let amountLineIndex: number;

    const potentialCard = lines[2].replace(/[\s-]/g, '');
    if (/^\d{13,19}$/.test(potentialCard) && lines.length >= 4) {
      cardNumber = potentialCard;
      amountLineIndex = 3;
    } else {
      amountLineIndex = 2;
    }

    const rawAmountToken = lines[amountLineIndex];
    const amount = this.tryParseAmount(rawAmountToken);

    if (!amount || amount <= 0) {
      return {
        success: false as const,
        error: 'Сумма должна быть положительным числом.',
      };
    }

    const comment = lines.slice(amountLineIndex + 1).join('\n').trim();

    return {
      success: true as const,
      data: [
        {
          amount,
          email,
          fullName,
          cardNumber,
          rawAmountToken,
          comment: comment || undefined,
        },
      ],
    };
  }

  protected async createRequest({
    currencyId,
    vendorId,
    rate,
    parsed,
  }: CreateRequestParams & { parsed: EurWiseParsedInput }): Promise<FullRequestType> {
    const request = await this.deps.requestService.createGeneralRequest({
      amount: parsed.amount,
      vendorId,
      currencyId,
      rateId: rate.id,
      rate: String(rate.rate ?? ''),
      method: {
        method: PaymentMethodEnum.WIZE,
        wise: {
          email: parsed.email,
          fullName: parsed.fullName,
          cardNumber: parsed.cardNumber ?? null,
          comment: parsed.comment ?? null,
        },
      },
    });

    return request as unknown as FullRequestType;
  }

  protected buildDetails(data: EurWiseParsedInput): string {
    const lines = [
      'Тип: EUR WISE',
      `Email: ${data.email}`,
      `ФИО: ${data.fullName}`,
      `Сумма (ввод): ${data.rawAmountToken}`,
      `Сумма (число): ${data.amount} EUR`,
    ];
    if (data.cardNumber) {
      lines.push(`Номер карты: ${data.cardNumber}`);
    }
    if (data.comment) {
      lines.push(`Комментарий: ${data.comment}`);
    }
    return lines.join('\n');
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private tryParseAmount(value: string): number | null {
    const normalized = value
      .replace(/[^0-9,\.]/g, '')
      .replace(/,/g, '.');
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
