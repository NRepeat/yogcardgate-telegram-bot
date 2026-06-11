import { PaymentMethodEnum } from '@prisma/client';
import { FullRequestType } from 'src/types/types';
import {
  CreateRequestParams,
  ParsedStrategyInput,
  EurBaseStrategy,
  EurStrategyDependencies,
  tryParseExtraChargePercent,
  applyExtraCharge,
  formatRateForStorage,
} from './eur-base.strategy';

interface EurIbanParsedInput extends ParsedStrategyInput {
  iban: string;
  name: string;
  comment?: string;
  extraChargePercent?: number;
}

export class EurIbanStrategy extends EurBaseStrategy {
  protected readonly methodEnum: PaymentMethodEnum = PaymentMethodEnum.IBAN;
  protected readonly typeLabel: string = 'EUR IBAN PERSONAL';

  constructor(deps: EurStrategyDependencies) {
    super(deps);
  }

  protected supportsMethod(method: PaymentMethodEnum): boolean {
    return method === this.methodEnum;
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
    // Apply extra charge if provided
    const finalRate = applyExtraCharge(rate.rate ?? 0, parsed.extraChargePercent);

    const request = await this.deps.requestService.createGeneralRequest({
      amount: parsed.amount,
      vendorId,
      currencyId,
      rateId: rate.id,
      rate: formatRateForStorage(finalRate),
      method: {
        method: this.methodEnum,
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
      `Тип: ${this.typeLabel}`,
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

    // Look for extra charge percent in the rest
    let extraChargePercent: number | undefined;
    const restWithoutPercent: string[] = [];
    for (const token of rest) {
      if (token.includes('%')) {
        const percentValue = tryParseExtraChargePercent(token);
        if (percentValue !== null && percentValue > 0) {
          extraChargePercent = percentValue;
        }
      } else {
        restWithoutPercent.push(token);
      }
    }

    const comment = restWithoutPercent.join(' ').trim() || undefined;

    return {
      success: true,
      data: {
        amount,
        iban,
        name,
        comment,
        extraChargePercent,
      },
      consumed: rest.length > 0 ? 4 + rest.length - restWithoutPercent.length : 3,
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
