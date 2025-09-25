import { PaymentMethodEnum } from '@prisma/client';
import { FullRequestType } from 'src/types/types';
import {
  CreateRequestParams,
  ParsedStrategyInput,
  EurBaseStrategy,
  EurStrategyDependencies,
} from './eur-base.strategy';

interface EurIbanParsedInput extends ParsedStrategyInput {
  iban: string;
  name: string;
  comment?: string;
}

export class EurIbanStrategy extends EurBaseStrategy {
  constructor(deps: EurStrategyDependencies) {
    super(deps);
  }

  protected supportsMethod(method: PaymentMethodEnum): boolean {
    return method === PaymentMethodEnum.IBAN;
  }

  protected parseInput(message: string) {
    const rows = message
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (rows.length < 3) {
      return {
        success: false as const,
        error: 'Нужно указать ФИО, IBAN и сумму (каждое с новой строки).',
      };
    }

    const parsed: EurIbanParsedInput[] = [];
    const chunkSize = 3; // name, iban, amount (+ optional comment)
    let index = 0;

    while (index < rows.length) {
      const slice = rows.slice(index, index + chunkSize + 1);
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
        error: 'Не удалось распознать данные IBAN.',
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
  }: CreateRequestParams & { parsed: EurIbanParsedInput }): Promise<FullRequestType> {
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
          inn: '',
          name: parsed.name,
          comment: parsed.comment ?? null,
        },
      },
    });

    return request as unknown as FullRequestType;
  }

  protected buildDetails(data: EurIbanParsedInput): string {
    const lines = [
      'Тип: EUR IBAN',
      `Получатель: ${data.name}`,
      `IBAN: <code>${data.iban}</code>`,
      `Сумма: ${data.amount} EUR`,
    ];
    if (data.comment) {
      lines.push(`Комментарий: ${data.comment}`);
    }
    return lines.join('\n');
  }

  private parseBlock(
    lines: string[],
  ):
    | { success: true; data: EurIbanParsedInput; consumed: number }
    | { success: false; error: string } {
    if (lines.length < 3) {
      return {
        success: false,
        error: 'Нужно указать ФИО, IBAN и сумму.',
      };
    }

    const [rawName, rawIban, rawAmount, ...rest] = lines;

    const name = rawName.trim();
    if (!name || name.length < 3) {
      return {
        success: false,
        error: 'Укажите корректное ФИО латиницей.',
      };
    }

    const iban = rawIban.replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z]{2}[0-9A-Z]{12,34}$/.test(iban)) {
      return {
        success: false,
        error: 'Укажите корректный IBAN.',
      };
    }

    const amount = this.tryParseAmount(rawAmount);
    if (!amount || amount <= 0) {
      return {
        success: false,
        error: 'Сумма должна быть положительным числом.',
      };
    }

    const comment = rest.join(' ').trim() || undefined;

    return {
      success: true,
      data: {
        amount,
        iban,
        name,
        comment,
      },
      consumed: comment ? 4 : 3,
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
