import { PaymentMethodEnum } from '@prisma/client';
import { FullRequestType } from 'src/types/types';
import {
  AedBaseStrategy,
  AedStrategyDependencies,
  CreateRequestParams,
  ParsedStrategyInput,
} from './aed-base.strategy';

interface AedIbanParsedInput extends ParsedStrategyInput {
  iban: string;
  name: string;
  bank?: string;
  comment?: string;
}

export class AedIbanStrategy extends AedBaseStrategy {
  constructor(deps: AedStrategyDependencies) {
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
        error: 'Нужно указать IBAN, ФИО и сумму (каждое с новой строки).',
      };
    }

    const parsed: AedIbanParsedInput[] = [];
    let index = 0;

    while (index < lines.length) {
      const block = lines.slice(index, index + 5);
      const result = this.parseBlock(block);
      if (!result.success) {
        return result;
      }
      parsed.push(result.data);
      index += result.consumed;
    }

    if (!parsed.length) {
      return {
        success: false as const,
        error: 'Не удалось разобрать данные для IBAN заявки.',
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
  }: CreateRequestParams & { parsed: AedIbanParsedInput }): Promise<FullRequestType> {
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
          inn: null,
          name: parsed.name,
          comment: commentParts.length ? commentParts.join('\n') : null,
        },
      },
    });

    return request as unknown as FullRequestType;
  }

  protected buildDetails(data: AedIbanParsedInput): string {
    const lines = [
      'Тип: AED IBAN',
      `Получатель: ${data.name}`,
      `IBAN: <code>${data.iban}</code>`,
      `Сумма: ${data.amount} AED`,
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
    | { success: true; data: AedIbanParsedInput; consumed: number }
    | { success: false; error: string } {
    if (lines.length < 3) {
      return {
        success: false,
        error: 'Нужно указать минимум три строки: IBAN, ФИО и сумму.',
      };
    }

    const [rawIban, rawName, ...rest] = lines;

    const iban = rawIban
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, '');

    if (iban.length < 15) {
      return {
        success: false,
        error: 'Укажите корректный IBAN.',
      };
    }

    const body = iban.slice(4);
    const isValidBody = /^[0-9A-Z]+$/.test(body);
    if (!isValidBody) {
      return {
        success: false,
        error: 'Укажите корректный IBAN.',
      };
    }

    const name = rawName.trim();
    if (!name || name.length < 3) {
      return {
        success: false,
        error: 'Укажите корректное ФИО латиницей.',
      };
    }

    if (rest.length === 0) {
      return {
        success: false,
        error: 'Укажите банк и сумму (каждое с новой строки).',
      };
    }
    const bank = rest[0]?.trim();
    
    if (!bank || bank.length < 2) {
      return {
        success: false,
        error: 'Укажите название банка (обязательно для AED).',
      };
    }

    let amountLineIndex = 1;
    let amount: number | null = null;

    while (amountLineIndex < rest.length && amount === null) {
      const attempt = this.tryParseAmount(rest[amountLineIndex]);
      if (attempt !== null && attempt > 0) {
        amount = attempt;
      } else {
        amountLineIndex++;
      }
    }

    if (amount === null || amount <= 0) {
      return {
        success: false,
        error: 'Сумма должна быть положительным числом.',
      };
    }

    const remaining = rest.slice(amountLineIndex + 1).filter(Boolean);
    const comment = remaining.length ? remaining.join('\n') : undefined;

    const consumed = 2 + rest.length;

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
