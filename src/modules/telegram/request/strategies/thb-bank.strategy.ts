import { PaymentMethodEnum } from '@prisma/client';
import { FullRequestType } from 'src/types/types';
import {
  ThbBaseStrategy,
  ThbStrategyDependencies,
  CreateRequestParams,
  ParsedStrategyInput,
} from './thb-base.strategy';

interface ThbBankParsedInput extends ParsedStrategyInput {
  recipient: string;
  account: string;
  bankName?: string;
  comment?: string;
}

export class ThbBankStrategy extends ThbBaseStrategy {
  constructor(deps: ThbStrategyDependencies) {
    super(deps);
  }

  protected supportsMethod(method: PaymentMethodEnum): boolean {
    return method === PaymentMethodEnum.BANK;
  }

  protected parseInput(message: string) {
    const lines = message
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    // Check if it's a single line format: "JOHN DOE 5000 1234567890"
    if (lines.length === 1) {
      return this.parseSingleLine(lines[0]);
    }

    // Multi-line format (existing logic)
    if (lines.length < 3) {
      return {
        success: false as const,
        error: 'Ожидались минимум три строки: ФИО, сумма и номер счёта.',
      };
    }

    const recipient = lines[0];        // ФИО
    const amountLine = lines[1];       // Сумма
    const account = lines[2];          // Номер счета
    const bankName = lines[3]?.trim(); // Название банка
    const comment = lines.slice(4).join('\n').trim();

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

    return {
      success: true as const,
      data: [
        {
          amount,
          recipient,
          account,
          bankName: bankName || undefined,
          comment: comment || undefined,
        },
      ],
    };
  }

  protected async createRequest({
    currencyId,
    vendorId,
    rate,
    parsed,
  }: CreateRequestParams & { parsed: ThbBankParsedInput }): Promise<FullRequestType> {
    const request = await this.deps.requestService.createGeneralRequest({
      amount: parsed.amount,
      vendorId,
      currencyId,
      rateId: rate.id,
      rate: String(rate.rate ?? ''),
      method: {
        method: PaymentMethodEnum.BANK,
        bank: {
          account: parsed.account,
          recipient: parsed.recipient,
          bankName: parsed.bankName ?? null,
          comment: parsed.comment ?? null,
        },
      },
    });

    return request as unknown as FullRequestType;
  }

  protected buildDetails(data: ThbBankParsedInput): string {
    const lines = [
      'Тип: THB BANK',
      `ФИО: ${data.recipient}`,
      `Счёт: ${data.account}`,
      `Сумма: ${data.amount} THB`,
    ];
    if (data.bankName) {
      lines.push(`Банк: ${data.bankName}`);
    }
    if (data.comment) {
      lines.push(`Комментарий: ${data.comment}`);
    }
    return lines.join('\n');
  }

  private parseSingleLine(line: string) {
    // Parse format: "JOHN DOE 5000 1234567890"
    const parts = line.trim().split(/\s+/);
    
    if (parts.length < 3) {
      return {
        success: false as const,
        error: 'Ожидался формат: ФИО СУММА НОМЕР_СЧЕТА (например: JOHN DOE 5000 1234567890)',
      };
    }

    // Second part should be the amount
    const rawAmountToken = parts[1];
    const amount = this.tryParseAmount(rawAmountToken);
    
    if (!amount || amount <= 0) {
      return {
        success: false as const,
        error: 'Сумма должна быть положительным числом.',
      };
    }

    // Third part should be the account number
    const account = parts[2];
    
    if (!account || account.length < 4) {
      return {
        success: false as const,
        error: 'Укажите корректный номер счёта.',
      };
    }

    // First part is the recipient name
    const recipient = parts[0];
    
    if (!recipient || recipient.length < 3) {
      return {
        success: false as const,
        error: 'Укажите корректное имя получателя.',
      };
    }

    return {
      success: true as const,
      data: [
        {
          amount,
          recipient,
          account,
          bankName: undefined,
          comment: undefined,
        },
      ],
    };
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
