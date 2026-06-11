import { PaymentMethodEnum } from '@prisma/client';
import { AznCardStrategy } from './azn-card.strategy';

export class AznOtherBanksStrategy extends AznCardStrategy {
  protected override readonly methodEnum: PaymentMethodEnum =
    PaymentMethodEnum.AZN_OTHER_BANKS;
  protected override readonly typeLabel: string = 'AZN CARD остальные банки';
}
