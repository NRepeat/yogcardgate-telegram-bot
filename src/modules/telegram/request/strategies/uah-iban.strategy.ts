import { PaymentMethodEnum } from '@prisma/client';
import { FullRequestType } from 'src/types/types';
import {
  CreateRequestParams,
  ParsedStrategyInput,
  UahBaseStrategy,
  UahStrategyDependencies,
} from './uah-base.strategy';

interface UahIbanParsedInput extends ParsedStrategyInput {
  iban: string;
  inn: string;
  name: string;
  comment?: string;
}

export class UahIbanStrategy extends UahBaseStrategy {
  constructor(deps: UahStrategyDependencies) {
    super(deps);
  }

  protected supportsMethod(method: PaymentMethodEnum): boolean {
    return method === PaymentMethodEnum.IBAN;
  }

  protected parseInput(message: string) {
    const lines = message
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 4) {
      return {
        success: false as const,
        error: 'Нужно указать ФИО, IBAN, ИНН и сумму (каждое с новой строки).',
      };
    }

    const [rawName, rawIban, rawInn, rawAmount, ...rest] = lines;

    const name = rawName.trim();
    if (!name || name.length < 3) {
      return {
        success: false as const,
        error: 'Укажите корректное ФИО латиницей.',
      };
    }

    const iban = rawIban.replace(/[^\w]/g, '').toUpperCase();
    if (!/^UA\d{27}$/.test(iban)) {
      return {
        success: false as const,
        error: 'IBAN должен начинаться с UA и содержать 29 символов.',
      };
    }

    const inn = rawInn.replace(/[^\d]/g, '');
    if (!/^\d{8}$/.test(inn) && !/^\d{10}$/.test(inn)) {
      return {
        success: false as const,
        error: 'ИНН должен содержать 8 или 10 цифр.',
      };
    }

    const amount = this.tryParseAmount(rawAmount);
    if (!amount || amount <= 0) {
      return {
        success: false as const,
        error: 'Сумма должна быть положительным числом.',
      };
    }

    const comment = rest.join(' ').trim() || undefined;

    return {
      success: true as const,
      data: [
        {
          amount,
          iban,
          inn,
          name,
          comment,
        },
      ],
    };
  }

  protected async createRequest({
    currencyId,
    vendorId,
    rate,
    parsed,
  }: CreateRequestParams & { parsed: UahIbanParsedInput }): Promise<FullRequestType> {
    const request = await this.deps.requestService.createGeneralRequest({
      amount: parsed.amount,
      vendorId,
      currencyId,
      rateId: rate.id,
      rate: String(rate.rate ?? ''),
      method: {
        method: PaymentMethodEnum.IBAN,
        iban: {
          iban: parsed.iban,
          inn: parsed.inn,
          name: parsed.name,
          comment: parsed.comment ?? null,
        },
      },
    });

    return request as unknown as FullRequestType;
  }

  protected buildDetails(data: UahIbanParsedInput): string {
    const lines = [
      'Тип: UAH IBAN',
      `Получатель: ${data.name}`,
      `IBAN: <code>${data.iban}</code>`,
      `ИНН: ${data.inn}`,
      `Сумма: ${data.amount} UAH`,
    ];
    if (data.comment) {
      lines.push(`Комментарий: ${data.comment}`);
    }
    return lines.join('\n');
  }

  private tryParseAmount(raw: string): number | null {
    const normalized = raw
      .replace(/[^\d,\.]/g, '')
      .replace(/,/g, '.');
    if (!normalized) {
      return null;
    }
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
  }
}
