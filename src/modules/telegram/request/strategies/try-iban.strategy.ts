import { PaymentMethodEnum } from '@prisma/client';
import { FullRequestType } from 'src/types/types';
import {
  TryBaseStrategy,
  TryStrategyDependencies,
  CreateRequestParams,
  ParsedStrategyInput,
} from './try-base.strategy';

interface TryIbanParsedInput extends ParsedStrategyInput {
  iban: string;
  name: string;
  bank?: string;
  comment?: string;
}

export class TryIbanStrategy extends TryBaseStrategy {
  constructor(deps: TryStrategyDependencies) {
    super(deps);
  }

  protected supportsMethod(method: PaymentMethodEnum): boolean {
    return method === PaymentMethodEnum.IBAN;
  }

  protected parseInput(message: string) {
    const lines = message
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 3) {
      return {
        success: false as const,
        error: 'Нужно указать имя, IBAN, сумму и при необходимости банк.',
      };
    }

    const parsed: TryIbanParsedInput[] = [];
    let index = 0;

    while (index < lines.length) {
      const slice = lines.slice(index, index + 5);
      const result = this.parseBlock(slice);
      if (!result.success) {
        return result;
      }
      parsed.push(result.data);
      index += result.consumed;
    }

    if (!parsed.length) {
      return {
        success: false as const,
        error: 'Не удалось разобрать данные для TRY IBAN заявки.',
      };
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
  }: CreateRequestParams & { parsed: TryIbanParsedInput }): Promise<FullRequestType> {
    const commentParts: string[] = [];
    if (parsed.bank) {
      commentParts.push(`Bank: ${parsed.bank}`);
    }
    if (parsed.comment) {
      commentParts.push(parsed.comment);
    }

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
          inn: 'N/A',
          name: parsed.name,
          comment: commentParts.length ? commentParts.join('\n') : null,
        },
      },
    });

    return request as unknown as FullRequestType;
  }

  protected buildDetails(data: TryIbanParsedInput): string {
    const lines = [
      'Тип: TRY IBAN',
      `Получатель: ${data.name}`,
      `IBAN: <code>${data.iban}</code>`,
      `Сумма: ${data.amount} TRY`,
    ];
    if (data.bank) {
      lines.push(`Банк: ${data.bank}`);
    }
    if (data.comment) {
      lines.push(`Комментарий: ${data.comment}`);
    }
    return lines.join('\n');
  }

  private parseBlock(
    lines: string[],
  ):
    | { success: true; data: TryIbanParsedInput; consumed: number }
    | { success: false; error: string } {
    if (lines.length < 3) {
      return {
        success: false,
        error: 'Нужно минимум три строки: ФИО, IBAN, сумма.',
      };
    }

    const [rawName, rawIban, rawAmount, rawBank, ...rest] = lines;

    const name = rawName.trim();
    if (!name || name.length < 3) {
      return {
        success: false,
        error: 'Укажите корректное имя латиницей.',
      };
    }

    const iban = rawIban.replace(/\s+/g, '').toUpperCase();
    if (!/^TR[0-9A-Z]{24}$/.test(iban)) {
      return {
        success: false,
        error: 'Укажите корректный турецкий IBAN.',
      };
    }

    const amount = this.tryParseAmount(rawAmount);
    if (!amount || amount <= 0) {
      return {
        success: false,
        error: 'Сумма должна быть положительным числом.',
      };
    }

    const bank = rawBank?.trim() || undefined;
    const comment = rest.join(' ').trim() || undefined;

    const consumed = 3 + (bank ? 1 : 0) + (comment ? 1 : 0);

    return {
      success: true,
      data: {
        amount,
        iban,
        name,
        bank,
        comment,
      },
      consumed,
    };
  }

  private tryParseAmount(raw: string): number | null {
    const normalized = raw
      .replace(/[^0-9,\.]/g, '')
      .replace(/,/g, '.');
    if (!normalized) {
      return null;
    }
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
  }
}
