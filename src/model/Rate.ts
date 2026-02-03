import { SerializedRate } from 'src/types/types';

export default class Rate implements SerializedRate {
  rate: number;
  minAmount: number;
  maxAmount: number;
  currencyId: string;
  paymentMethodId: string;
  enabled: boolean;

  constructor(
    rate: number,
    minAmount: number,
    maxAmount: number,
    currencyId: string,
    paymentMethodId: string,
    enabled: boolean = true,
  ) {
    this.rate = rate;
    this.minAmount = minAmount;
    this.maxAmount = maxAmount;
    this.currencyId = currencyId;
    this.paymentMethodId = paymentMethodId;
    this.enabled = enabled;
  }
}
