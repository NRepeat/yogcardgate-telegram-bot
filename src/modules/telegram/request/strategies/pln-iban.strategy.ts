import { PaymentMethodEnum } from '@prisma/client';
import { FullRequestType } from 'src/types/types';
import {
  PlnBaseStrategy,
  PlnStrategyDependencies,
  CreateRequestParams,
  ParsedStrategyInput,
} from './pln-base.strategy';

interface PlnIbanParsedInput extends ParsedStrategyInput {
  iban: string;
  name: string;
  comment?: string;
}

export class PlnIbanStrategy extends PlnBaseStrategy {
  constructor(deps: PlnStrategyDependencies) {
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
        error: 'Нужно указать IBAN, имя и сумму (каждое с новой строки).',
      };
    }

    const parsed: PlnIbanParsedInput[] = [];
    const chunkSize = 3;
    let index = 0;

    while (index < lines.length) {
      const slice = lines.slice(index, index + chunkSize + 1);
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
        error: 'Не удалось распознать данные для PLN IBAN заявки.',
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
  }: CreateRequestParams & { parsed: PlnIbanParsedInput }): Promise<FullRequestType> {
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
          comment: parsed.comment ?? null,
        },
      },
    });

    return request as unknown as FullRequestType;
  }

  protected buildDetails(data: PlnIbanParsedInput): string {
    const lines = [
      'Тип: PLN IBAN',
      `Получатель: ${data.name}`,
      `IBAN: <code>${data.iban}</code>`,
      `Сумма: ${data.amount} PLN`,
    ];
    if (data.comment) {
      lines.push(`Комментарий: ${data.comment}`);
    }
    return lines.join('\n');
  }

  private parseBlock(
    lines: string[],
  ):
    | { success: true; data: PlnIbanParsedInput; consumed: number }
    | { success: false; error: string } {
    if (lines.length < 3) {
      return {
        success: false,
        error: 'Нужно минимум три строки: IBAN, имя и сумма.',
      };
    }

    const [rawName, rawIban, rawAmount, ...rest] = lines;

    const name = rawName.trim();
    if (!name || name.length < 3) {
      return {
        success: false,
        error: 'Укажите корректное имя латиницей.',
      };
    }

    const iban = rawIban.replace(/\s+/g, '').toUpperCase();
    if (!/^PL[0-9A-Z]{26}$/.test(iban)) {
      return {
        success: false,
        error: 'Укажите корректный польский IBAN.',
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
    const consumed = 3 + (comment ? 1 : 0);

    return {
      success: true,
      data: {
        amount,
        iban,
        name,
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
