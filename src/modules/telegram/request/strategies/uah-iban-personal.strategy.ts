import { PaymentMethodEnum } from '@prisma/client';
import { UahIbanStrategy } from './uah-iban.strategy';

export class UahIbanPersonalStrategy extends UahIbanStrategy {
  protected override readonly methodEnum: PaymentMethodEnum =
    PaymentMethodEnum.IBAN_PERSONAL;
  protected override readonly typeLabel: string = 'UAH IBAN с ФИЗ на ФИЗ';
}
