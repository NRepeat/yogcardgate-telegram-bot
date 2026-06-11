import { PaymentMethodEnum } from '@prisma/client';
import { ThbBankStrategy } from './thb-bank.strategy';

export class ThbOtherBanksStrategy extends ThbBankStrategy {
  protected override readonly methodEnum: PaymentMethodEnum =
    PaymentMethodEnum.THB_OTHER_BANKS;
  protected override readonly typeLabel: string = 'THB BANK остальные банки';
}
