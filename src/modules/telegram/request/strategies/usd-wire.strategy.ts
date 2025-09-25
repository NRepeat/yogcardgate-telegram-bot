import { PaymentMethodEnum } from '@prisma/client';
import { FullRequestType } from 'src/types/types';
import {
  CreateRequestParams,
  ParsedStrategyInput,
  UsdBaseStrategy,
} from './usd-base.strategy';

interface UsdWireParsedInput extends ParsedStrategyInput {
  account: string;
  recipient: string;
  bank?: string;
  comment?: string;
  rawAmountToken: string;
}

export class UsdWireStrategy extends UsdBaseStrategy {
  protected supportsMethod(method: PaymentMethodEnum): boolean {
    return method === PaymentMethodEnum.WIRE;
  }

  protected parseInput(message: string) {
    const lines = message
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 3) {
      return {
        success: false as const,
        error:
          'Ожидались минимум три строки: сумма, номер счёта и имя получателя.',
      };
    }

    const amount = this.tryParseAmount(lines[0]);
    if (!amount || amount <= 0) {
      return {
        success: false as const,
        error: 'Сумма должна быть положительным числом.',
      };
    }

    const account = lines[1].replace(/\s+/g, '');
    if (account.length < 6) {
      return {
        success: false as const,
        error: 'Номер счёта слишком короткий.',
      };
    }

    const recipient = lines[2];
    if (!recipient || recipient.length < 3) {
      return {
        success: false as const,
        error: 'Имя получателя указано некорректно.',
      };
    }

    const bank = lines[3]?.trim();
    const comment = lines.slice(4).join('\n').trim();

    return {
      success: true as const,
      data: {
        amount,
        account,
        recipient,
        bank: bank || undefined,
        comment: comment || undefined,
        rawAmountToken: lines[0],
      },
    };
  }

  protected async createRequest({
    currencyId,
    vendorId,
    rate,
    parsed,
  }: CreateRequestParams & { parsed: UsdWireParsedInput }): Promise<FullRequestType> {
    const request = await this.deps.requestService.createGeneralRequest({
      amount: parsed.amount,
      vendorId,
      currencyId,
      rateId: rate.id,
      rate: String(rate.rate ?? ''),
      paymentMethod: PaymentMethodEnum.WIRE,
    });

    return request as unknown as FullRequestType;
  }

  protected buildDetails(data: UsdWireParsedInput): string {
    const lines = [
      'Тип: USD WIRE',
      `Сумма (ввод): ${data.rawAmountToken}`,
      `Сумма (число): ${data.amount} USD`,
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
