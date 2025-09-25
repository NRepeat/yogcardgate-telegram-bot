import { PaymentMethodEnum } from '@prisma/client';
import { FullRequestType } from 'src/types/types';
import {
  KztBaseStrategy,
  KztStrategyDependencies,
  CreateRequestParams,
  ParsedStrategyInput,
} from './kzt-base.strategy';

interface KztPhoneParsedInput extends ParsedStrategyInput {
  phone: string;
  holderName?: string;
}

export class KztPhoneStrategy extends KztBaseStrategy {
  constructor(deps: KztStrategyDependencies) {
    super(deps);
  }

  protected supportsMethod(method: PaymentMethodEnum): boolean {
    return method === PaymentMethodEnum.PHONE;
  }

  protected parseInput(message: string) {
    const lines = message
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const rows = lines.length ? lines : [message.trim()];
    const parsed: KztPhoneParsedInput[] = [];

    for (const row of rows) {
      const tokens = row
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean);

      if (!tokens.length) {
        continue;
      }

      const phoneToken = tokens.find((token) =>
        /^\+?\d{7,15}$/.test(token.replace(/[^\d+]/g, '')),
      );

      if (!phoneToken) {
        return {
          success: false as const,
          error: 'Укажите номер телефона получателя.',
        };
      }

      const remainingTokens = tokens.filter((token) => token !== phoneToken);

      const amountToken = remainingTokens.find((token) => {
        const numeric = this.tryParseAmount(token);
        return numeric !== null && numeric > 0;
      });

      if (!amountToken) {
        return {
          success: false as const,
          error: 'Укажите сумму перевода.',
        };
      }

      const amount = this.tryParseAmount(amountToken);
      if (!amount || amount <= 0) {
        return {
          success: false as const,
          error: 'Сумма должна быть положительным числом.',
        };
      }

      const phone = phoneToken.replace(/[^\d+]/g, '');
      const holderTokens = remainingTokens.filter((token) => token !== amountToken);
      const holderName = holderTokens.join(' ').trim() || undefined;

      parsed.push({ amount, phone, holderName });
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
  }: CreateRequestParams & { parsed: KztPhoneParsedInput }): Promise<FullRequestType> {
    const request = await this.deps.requestService.createGeneralRequest({
      amount: parsed.amount,
      vendorId,
      currencyId,
      rateId: rate.id,
      rate: String(rate.rate ?? ''),
      method: {
        method: PaymentMethodEnum.PHONE,
        phone: {
          phoneNumber: parsed.phone,
          holderName: parsed.holderName ?? null,
          comment: null,
        },
      },
    });

    return request as unknown as FullRequestType;
  }

  protected buildDetails(data: KztPhoneParsedInput): string {
    const lines = [
      'Тип: KZT PHONE',
      `Телефон: ${data.phone}`,
      `Сумма: ${data.amount} KZT`,
    ];
    if (data.holderName) {
      lines.push(`Получатель: ${data.holderName}`);
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
