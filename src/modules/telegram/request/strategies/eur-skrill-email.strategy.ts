import { PaymentMethodEnum } from '@prisma/client';
import { FullRequestType } from 'src/types/types';
import {
  CreateRequestParams,
  ParsedStrategyInput,
  EurBaseStrategy,
  EurStrategyDependencies,
} from './eur-base.strategy';

interface EurSkrillParsedInput extends ParsedStrategyInput {
  email: string;
  rawAmountToken: string;
  comment?: string;
}

export class EurSkrillEmailStrategy extends EurBaseStrategy {
  constructor(deps: EurStrategyDependencies) {
    super(deps);
  }

  protected supportsMethod(method: PaymentMethodEnum): boolean {
    return method === PaymentMethodEnum.SKRILL_EMAIL;
  }

  protected parseInput(message: string) {
    const lines = message
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return {
        success: false as const,
        error: 'Ожидались две строки: email и сумма перевода.',
      };
    }

    const email = lines[0];
    if (!this.isValidEmail(email)) {
      return {
        success: false as const,
        error: 'Некорректный email. Проверьте формат.',
      };
    }

    const amount = this.tryParseAmount(lines[1]);
    if (!amount || amount <= 0) {
      return {
        success: false as const,
        error: 'Сумма должна быть положительным числом.',
      };
    }

    const comment = lines.slice(2).join('\n').trim();

    return {
      success: true as const,
      data: [
        {
          amount,
          email,
          rawAmountToken: lines[1],
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
  }: CreateRequestParams & { parsed: EurSkrillParsedInput }): Promise<FullRequestType> {
    const request = await this.deps.requestService.createGeneralRequest({
      amount: parsed.amount,
      vendorId,
      currencyId,
      rateId: rate.id,
      rate: String(rate.rate ?? ''),
      method: {
        method: PaymentMethodEnum.SKRILL_EMAIL,
        skrill: {
          email: parsed.email,
          comment: parsed.comment ?? null,
        },
      },
    });

    return request as unknown as FullRequestType;
  }

  protected buildDetails(data: EurSkrillParsedInput): string {
    const lines = [
      'Тип: EUR SKRILL_EMAIL',
      `Email: ${data.email}`,
      `Сумма (ввод): ${data.rawAmountToken}`,
      `Сумма (число): ${data.amount} EUR`,
    ];
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
