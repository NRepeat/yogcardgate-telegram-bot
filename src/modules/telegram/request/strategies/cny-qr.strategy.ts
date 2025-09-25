import { PaymentMethodEnum } from '@prisma/client';
import { FullRequestType } from 'src/types/types';
import {
  CnyBaseStrategy,
  CnyStrategyDependencies,
  CreateRequestParams,
  ParsedStrategyInput,
} from './cny-base.strategy';

interface CnyQrParsedInput extends ParsedStrategyInput {
  identifier: string;
  recipient?: string;
}

export class CnyQrStrategy extends CnyBaseStrategy {
  constructor(deps: CnyStrategyDependencies) {
    super(deps);
  }

  protected supportsMethod(method: PaymentMethodEnum): boolean {
    return method === PaymentMethodEnum.QR;
  }

  protected parseInput(message: string) {
    const blocks = message
      .split(/\n{2,}/)
      .map((block) =>
        block
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
      )
      .filter((lines) => lines.length > 0);

    if (blocks.length === 0) {
      const single = message
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (single.length) {
        blocks.push(single);
      }
    }

    if (blocks.length === 0) {
      return {
        success: false as const,
        error: 'Укажите сумму, идентификатор и ФИО получателя.',
      };
    }

    const parsed: CnyQrParsedInput[] = [];
    for (const lines of blocks) {
      if (lines.length < 2) {
        return {
          success: false as const,
          error: 'Для CNY требуется минимум две строки: сумма и идентификатор.',
        };
      }

      const amountLine = lines[0];
      const identifier = lines[1];
      const recipient = lines[2] ?? undefined;
      const comment = lines.slice(3).join('\n').trim() || undefined;

      const amount = this.tryParseAmount(amountLine);
      if (!amount || amount <= 0) {
        return {
          success: false as const,
          error: 'Сумма должна быть положительным числом.',
        };
      }

      if (!identifier || identifier.length < 3) {
        return {
          success: false as const,
          error: 'Укажите идентификатор получателя.',
        };
      }

      parsed.push({ amount, identifier, recipient, comment });
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
  }: CreateRequestParams & { parsed: CnyQrParsedInput }): Promise<FullRequestType> {
    const request = await this.deps.requestService.createGeneralRequest({
      amount: parsed.amount,
      vendorId,
      currencyId,
      rateId: rate.id,
      rate: String(rate.rate ?? ''),
      method: {
        method: PaymentMethodEnum.QR,
        qr: {
          identifier: parsed.identifier,
          comment: parsed.recipient || parsed.comment ? [parsed.recipient, parsed.comment]
            .filter(Boolean)
            .join('\n')
            : null,
        },
      },
    });

    return request as unknown as FullRequestType;
  }

  protected buildDetails(data: CnyQrParsedInput): string {
    const lines = [
      'Тип: CNY QR',
      `Идентификатор: ${data.identifier}`,
      `Сумма: ${data.amount} CNY`,
    ];
    if (data.recipient) {
      lines.push(`Получатель: ${data.recipient}`);
    }
    return lines.join('\n');
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
