import { CurrencyEnum, PaymentMethodEnum } from '@prisma/client';
import { CustomSceneContext, FullRequestType } from 'src/types/types';

export interface StrategyExecuteContext {
  ctx: CustomSceneContext;
  message: string;
  currency: {
    id: string;
    name: CurrencyEnum;
    code: string;
  };
}

export interface StrategySuccessResult {
  status: 'success';
  request: FullRequestType;
  details: string;
}

export interface StrategyErrorResult {
  status: 'error';
  error: string;
}

export type StrategyResult = StrategySuccessResult | StrategyErrorResult;

export interface PaymentRequestStrategy {
  supports(currency: CurrencyEnum, method: PaymentMethodEnum): boolean;
  execute(
    method: PaymentMethodEnum,
    context: StrategyExecuteContext,
  ): Promise<StrategyResult>;
}
