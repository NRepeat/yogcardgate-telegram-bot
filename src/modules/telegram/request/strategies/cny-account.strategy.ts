import { PaymentMethodEnum } from '@prisma/client';
import { FullRequestType } from 'src/types/types';
import {
  CnyBaseStrategy,
  CnyStrategyDependencies,
  CreateRequestParams,
  ParsedStrategyInput,
} from './cny-base.strategy';

interface CnyAccountParsedInput extends ParsedStrategyInput {
  accountNumber: string;
  holderName: string;
}

export class CnyAccountStrategy extends CnyBaseStrategy {
  constructor(deps: CnyStrategyDependencies) {
    super(deps);
  }

  protected supportsMethod(method: PaymentMethodEnum): boolean {
    return method === PaymentMethodEnum.CNY_ACCOUNT;
  }

  protected parseInput(message: string) {
    const lines = message
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    let accountNumber: string;
    let amount: number;
    let holderName: string;

    if (lines.length === 1) {
      // Single line format: "1234567890123456 3000 张三"
      const singleLineMatch = lines[0].match(/^(\d+)\s+(\d+(?:\.\d+)?)\s+(.+)$/);
      if (!singleLineMatch) {
        return {
          success: false as const,
          error: 'Неверный формат. Используйте: Номер счета Сумма ФИО на китайском',
        };
      }
      accountNumber = singleLineMatch[1];
      amount = parseFloat(singleLineMatch[2]);
      holderName = singleLineMatch[3];
    } else if (lines.length >= 2) {
      // Two line format: "1234567890123456 3000" on first line, "张三" on second line
      const accountDataLine = lines[0];
      holderName = lines[1];

      const accountAmountMatch = accountDataLine.match(/^(\d+)\s+(\d+(?:\.\d+)?)$/);
      if (!accountAmountMatch) {
        return {
          success: false as const,
          error: 'Неверный формат первой строки. Используйте: Номер счета Сумма',
        };
      }
      accountNumber = accountAmountMatch[1];
      amount = parseFloat(accountAmountMatch[2]);
    } else {
      return {
        success: false as const,
        error: 'Укажите номер счета, сумму и ФИО на китайском. Формат: Номер счета Сумма ФИО на китайском',
      };
    }

    if (!accountNumber || accountNumber.length < 10) {
      return {
        success: false as const,
        error: 'Номер счета должен содержать минимум 10 цифр.',
      };
    }

    if (!amount || amount <= 0) {
      return {
        success: false as const,
        error: 'Сумма должна быть положительным числом.',
      };
    }

    if (!holderName || holderName.length < 2) {
      return {
        success: false as const,
        error: 'Укажите ФИО на китайском языке.',
      };
    }

    return {
      success: true as const,
      data: [{ amount, accountNumber, holderName }],
    };
  }

  protected async createRequest({
    currencyId,
    vendorId,
    rate,
    parsed,
  }: CreateRequestParams & { parsed: CnyAccountParsedInput }): Promise<FullRequestType> {
    const request = await this.deps.requestService.createGeneralRequest({
      amount: parsed.amount,
      vendorId,
      currencyId,
      rateId: rate.id,
      rate: String(rate.rate ?? ''),
      method: {
        method: PaymentMethodEnum.CNY_ACCOUNT,
        wire: {
          account: parsed.accountNumber,
          recipient: parsed.holderName,
          comment: `Chinese Bank Account\nHolder: ${parsed.holderName}`,
        },
      },
    });

    return request as unknown as FullRequestType;
  }

  protected buildDetails(data: CnyAccountParsedInput): string {
    const lines = [
      'Тип: CNY Account',
      `Номер счета: ${data.accountNumber}`,
      `ФИО: ${data.holderName}`,
      `Сумма: ${data.amount} CNY`,
    ];
    return lines.join('\n');
  }
}
