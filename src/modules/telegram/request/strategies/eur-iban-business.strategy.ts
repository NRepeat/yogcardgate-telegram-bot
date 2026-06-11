import { PaymentMethodEnum } from '@prisma/client';
import { EurIbanStrategy } from './eur-iban.strategy';

export class EurIbanBusinessStrategy extends EurIbanStrategy {
  protected override readonly methodEnum: PaymentMethodEnum =
    PaymentMethodEnum.EUR_IBAN_BUSINESS;
  protected override readonly typeLabel: string = 'EUR IBAN BUSINESS';
}
