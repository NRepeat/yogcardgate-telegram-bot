import { PaymentMethodEnum } from '@prisma/client';
import { FullRequestType } from 'src/types/types';
import {
  CreateRequestParams,
  ParsedStrategyInput,
  UsdBaseStrategy,
} from './usd-base.strategy';
import { tryParseExtraChargePercent, applyExtraCharge, formatRateForStorage } from './usd-base.strategy';

interface UsdPayoneerParsedInput extends ParsedStrategyInput {
  email: string;
  rawAmountToken: string;
  comment?: string;
}

export class UsdPayoneerStrategy extends UsdBaseStrategy {
  protected supportsMethod(method: PaymentMethodEnum): boolean {
    return method === PaymentMethodEnum.PAYONEER;
  }

  protected parseInput(message: string) {
    const lines = message
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    // Check if it's a single line format: "user@example.com 5000"
    if (lines.length === 1) {
      return this.parseSingleLine(lines[0]);
    }

    // Multi-line format (existing logic)
    if (lines.length < 2) {
      return {
        success: false as const,
        error: 'Ожидались две строки: email Payoneer и сумма перевода.',
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
  }: CreateRequestParams & { parsed: UsdPayoneerParsedInput }): Promise<FullRequestType> {
    const request = await this.deps.requestService.createGeneralRequest({
      amount: parsed.amount,
      vendorId,
      currencyId,
      rateId: rate.id,
      rate: formatRateForStorage(applyExtraCharge(rate.rate ?? 0, parsed.extraChargePercent)),
      method: {
        method: PaymentMethodEnum.PAYONEER,
        payoneer: {
          email: parsed.email,
          comment: parsed.comment ?? null,
        },
      },
    });

    return request as unknown as FullRequestType;
  }

  protected buildDetails(data: UsdPayoneerParsedInput): string {
    const lines = [
      'Тип: USD PAYONEER',
      `Email: ${data.email}`,
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

  private parseSingleLine(line: string) {
    // Parse format: "user@example.com 5000"
    const parts = line.trim().split(/\s+/);
    
    if (parts.length < 2) {
      return {
        success: false as const,
        error: 'Ожидался формат: EMAIL СУММА (например: user@example.com 5000)',
      };
    }

    // Last part should be the amount
    const rawAmountToken = parts[parts.length - 1];
    const amount = this.tryParseAmount(rawAmountToken);
    
    if (!amount || amount <= 0) {
      return {
        success: false as const,
        error: 'Сумма должна быть положительным числом.',
      };
    }

    // Everything before amount is the email
    const email = parts.slice(0, parts.length - 1).join(' ');
    
    if (!this.isValidEmail(email)) {
      return {
        success: false as const,
        error: 'Некорректный email. Проверьте формат.',
      };
    }

    return {
      success: true as const,
      data: [
        {
          amount,
          email,
          rawAmountToken,
          comment: undefined,
        },
      ],
    };
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
