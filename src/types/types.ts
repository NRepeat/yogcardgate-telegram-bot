import {
  AdminRequestPhotoMessage,
  BankPaymentRequestsMethod,
  BlackList,
  CardBank,
  CardPaymentRequestsMethod,
  Currency,
  IbanPaymentRequestsMethod,
  PaymentRequestMethod,
  PhonePaymentRequestsMethod,
  PayoneerPaymentRequestsMethod,
  QrPaymentRequestsMethod,
  Message,
  PaymentMethod,
  PaymentRequests,
  Rates,
  SkrillEmailPaymentRequestsMethod,
  RoleEnum,
  CurrencyEnum as PrismaCurrencyEnum,
  PaymentMethodEnum as PrismaPaymentMethodEnum,
  WirePaymentRequestsMethod,
  User,
  Vendors,
} from '@prisma/client';
import { Scenes } from 'telegraf';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';

export type SerializedUser = Omit<User, 'createdAt' | 'updatedAt' | 'id'>;
export enum UserRole {
  ADMIN = '1',
  WORKER = '0',
}
