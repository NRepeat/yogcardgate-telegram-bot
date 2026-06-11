import { PaymentMethodEnum } from '@prisma/client';
import { UahIbanStrategy } from './uah-iban.strategy';

export class UahIbanCompanyStrategy extends UahIbanStrategy {
  protected override readonly methodEnum: PaymentMethodEnum =
    PaymentMethodEnum.IBAN_COMPANY;
  protected override readonly typeLabel: string = 'UAH IBAN (компания)';
}
