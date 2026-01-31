import { PaymentMethodEnum } from '@prisma/client';
import { FullRequestType } from 'src/types/types';
import {
  CreateRequestParams,
  ParsedStrategyInput,
  UsdBaseStrategy,
} from './usd-base.strategy';

interface UsdPayPalParsedInput extends ParsedStrategyInput {
  email: string;
  fullName: string;
  rawAmountToken: string;
  comment?: string;
}

export class UsdPayPalStrategy extends UsdBaseStrategy {
  protected supportsMethod(method: PaymentMethodEnum): boolean {
    return method === PaymentMethodEnum.PAYPAL;
  }

  protected parseInput(message: string) {
    const lines = message
      .split('\n')
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

    const rawAmountToken = lines[2];
    const amount = this.tryParseAmount(rawAmountToken);

    if (!amount || amount <= 0) {
      return {
        success: false as const,
        error: 'Сумма должна быть положительным числом.',
      };
    }

    const comment = lines.slice(3).join('\n').trim();

    return {
      success: true as const,
      data: [
        {
          amount,
          email,
          fullName,
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
  }: CreateRequestParams & { parsed: UsdPayPalParsedInput }): Promise<FullRequestType> {
    const request = await this.deps.requestService.createGeneralRequest({
      amount: parsed.amount,
      vendorId,
      currencyId,
      rateId: rate.id,
      rate: String(rate.rate ?? ''),
      method: {
        method: PaymentMethodEnum.PAYPAL,
        paypal: {
          email: parsed.email,
          fullName: parsed.fullName,
          comment: parsed.comment ?? null,
        },
      },
    });

    return request as unknown as FullRequestType;
  }

  protected buildDetails(data: UsdPayPalParsedInput): string {
    const lines = [
      'Тип: USD PAYPAL',
      `Email: ${data.email}`,
      `ФИО: ${data.fullName}`,
      `Сумма (ввод): ${data.rawAmountToken}`,
      `Сумма (число): ${data.amount} USD`,
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
