import { PaymentMethodEnum } from '@prisma/client';
import { FullRequestType } from 'src/types/types';
import {
  ThbBaseStrategy,
  ThbStrategyDependencies,
  CreateRequestParams,
  ParsedStrategyInput,
} from './thb-base.strategy';

interface ThbWireParsedInput extends ParsedStrategyInput {
  account: string;
  recipient: string;
  bank?: string;
  comment?: string;
}

export class ThbWireStrategy extends ThbBaseStrategy {
  constructor(deps: ThbStrategyDependencies) {
    super(deps);
  }

  protected supportsMethod(method: PaymentMethodEnum): boolean {
    return method === PaymentMethodEnum.WIRE;
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
        error:
          'Укажите данные строками: сумма, номер счёта, ФИО и при необходимости банк.',
      };
    }

    const parsed: ThbWireParsedInput[] = [];
    for (const lines of blocks) {
      const amountLine = lines[0];
      const account = lines[1];
      const recipient = lines[2];
      const bank = lines[3] ?? undefined;
      const comment = lines.slice(4).join('\n').trim() || undefined;

      const amount = this.tryParseAmount(amountLine);
      if (!amount || amount <= 0) {
        return {
          success: false as const,
          error: 'Сумма должна быть положительным числом.',
        };
      }

      if (!account || account.length < 4) {
        return {
          success: false as const,
          error: 'Укажите корректный номер счёта.',
        };
      }

      if (!recipient || recipient.length < 3) {
        return {
          success: false as const,
          error: 'Укажите корректное имя получателя.',
        };
      }

      parsed.push({ amount, account, recipient, bank, comment });
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
  }: CreateRequestParams & { parsed: ThbWireParsedInput }): Promise<FullRequestType> {
    const request = await this.deps.requestService.createGeneralRequest({
      amount: parsed.amount,
      vendorId,
      currencyId,
      rateId: rate.id,
      rate: String(rate.rate ?? ''),
      method: {
        method: PaymentMethodEnum.WIRE,
        wire: {
          account: parsed.account,
          recipient: parsed.recipient,
          bankName: parsed.bank ?? null,
          comment: parsed.comment ?? null,
        },
      },
    });

    return request as unknown as FullRequestType;
  }

  protected buildDetails(data: ThbWireParsedInput): string {
    const lines = [
      'Тип: THB WIRE',
      `Сумма: ${data.amount} THB`,
      `Счёт: ${data.account}`,
      `Получатель: ${data.recipient}`,
    ];
    if (data.bank) {
      lines.push(`Банк: ${data.bank}`);
    }
    if (data.comment) {
      lines.push(`Комментарий: ${data.comment}`);
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
