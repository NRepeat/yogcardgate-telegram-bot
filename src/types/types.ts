import {
  AdminRequestPhotoMessage,
  BankPaymentRequestsMethod,
  BlackList,
  CardBank,
  CardPaymentRequestsMethod,
  Currency,
  GenericPaymentRequestsMethod,
  IbanPaymentRequestsMethod,
  PaymentRequestMethod,
  PhonePaymentRequestsMethod,
  PayoneerPaymentRequestsMethod,
  QrPaymentRequestsMethod,
  WisePaymentRequestsMethod,
  PayPalPaymentRequestsMethod,
  Message,
  PaymentMethod,
  PaymentRequests,
  Rates,
  SkrillEmailPaymentRequestsMethod,
  RoleEnum,
  CurrencyEnum as PrismaCurrencyEnum,
  PaymentMethodEnum as PrismaPaymentMethodEnum,
  User,
  Vendors,
} from '@prisma/client';
import { Scenes } from 'telegraf';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';

export type SerializedUser = SerializedModel<User & { role?: RoleEnum }>;
export type SerializedRate = SerializedModel<Rates>;
// minOrderUsd is optional on write — the column has a DB default
export type SerializedVendors = Omit<SerializedModel<Vendors>, 'minOrderUsd'> & {
  minOrderUsd?: number;
};
export type SerializedPaymentMethod = SerializedModel<PaymentMethod>;
export type SerializedRequest = SerializedModel<PaymentRequests>;
export type SerializedMessage = Omit<
  SerializedModel<Message>,
  | 'adminRequestPhotoMessageId'
  | 'workerRequestPhotoMessageId'
  | 'vendorRequestPhotoMessageId'
> & {
  paymentRequests?: {
    vendor: Vendors;
  };
};
export type SerializedModel<T> = Omit<T, 'createdAt' | 'updatedAt' | 'id'>;
export type IbanRequestType = Omit<
  SerializedRequest,
  | 'payedByUserId'
  | 'completedAt'
  | 'error'
  | 'user'
  | 'userId'
  | 'ratesId'
  | 'activeUserId'
  | 'paymentMethodId'
> & {
  rateId: string;
  blackList?: BlackList;
  iban: Omit<
    IbanPaymentRequestsMethod,
    'id' | 'createdAt' | 'updatedAt' | 'requestId'
  >;
};
// Extend session for wizard scenes
export interface CustomSession extends Scenes.WizardSessionData {
  messagesToDelete?: number[];
  requestMenuMessageId?: number[];
  customState?: string; // renamed from 'state' to avoid conflict
  requestType?: string; // card, iban, etc
  selectedCurrencyId?: string;
  paymentMethodsMeta?: {
    name: string;
    buttonLabel: string;
    instruction?: string | null;
    rawDescription?: string | null;
    rawDescriptionEn?: string | null;
    form?: PaymentMethodFormDefinition | null;
  }[];
}
export type CardRequestType = {
  amount: number;
  vendorId: string;
  currencyId: string;
  rateId: string;
  rate?: string;
  blackList?: BlackList;
  card: {
    card: string;
    holder?: string;
    comment?: string;
    bankId?: string;
  };
};
export type FullRequestType = PaymentRequests & {
  methods?: (PaymentRequestMethod & {
    cardDetails?:
      | (CardPaymentRequestsMethod & {
          blackList?: BlackList[];
          bank?: CardBank;
        })
      | null;
    ibanDetails?: IbanPaymentRequestsMethod | null;
    bankDetails?: BankPaymentRequestsMethod | null;
    phoneDetails?: PhonePaymentRequestsMethod | null;
    skrillDetails?: SkrillEmailPaymentRequestsMethod | null;
    payoneerDetails?: PayoneerPaymentRequestsMethod | null;
    qrDetails?: QrPaymentRequestsMethod | null;
    wiseDetails?: WisePaymentRequestsMethod | null;
    paypalDetails?: PayPalPaymentRequestsMethod | null;
    genericDetails?: GenericPaymentRequestsMethod | null;
  })[];
  message?: Message[];
  vendor?: Vendors;
  user?: SerializedUser;
  activeUser?: User;
  paymentMethod?: SerializedPaymentMethod;
  adminRequestPhotoMessage?: AdminRequestPhotoMessage[];
  currency?: Currency;
  rates?: Rates;
  payedByUser?: User;
};
export type MessageAccessType = 'public' | 'admin' | 'worker';
// Extend context for wizard scenes
export type CustomSceneContext = Scenes.WizardContext & {
  session: CustomSession;
};

export interface PaymentFormFieldDefinition {
  label: string;
  description?: string;
  example?: string;
  optional?: boolean;
}

export interface PaymentMethodFormDefinition {
  title: string;
  intro?: string;
  fields: PaymentFormFieldDefinition[];
  sample?: string;
  notes?: string[];
}

export type PaymentFormRegistry = Partial<
  Record<
    PrismaCurrencyEnum,
    Partial<Record<PrismaPaymentMethodEnum, PaymentMethodFormDefinition>>
  >
>;

export type PaymentFormConfig = {
  currency: PrismaCurrencyEnum;
  forms: Partial<Record<PrismaPaymentMethodEnum, PaymentMethodFormDefinition>>;
};

// export enum UserRole {
//   ADMIN = '1',
//   WORKER = '0',
//   GEEST = '2',
// }

// export enum CurrencyEnum {
//   UAH = '0',
//   USD = '1',
// }

// export enum PaymentMethodEnum {
//   CARD = '0',
//   IBAN = '1',
// }

export interface Repository<T> {
  findById?(id: string): Promise<T | null>;
  create(data: Omit<T, 'id'>): Promise<T | null>;
  update?(id: string, data: Partial<T>): Promise<T>;
  getAll?(): Promise<T[]>;
  deleteAll?(): Promise<boolean>;
}

export interface ParsedMessageRates {
  header: string;
  lines: string[];
}

export interface ReplyMessage {
  text: string;
  inline_keyboard?: InlineKeyboardMarkup;
}
export interface ReplyPhotoMessage extends ReplyMessage {
  source?: Buffer<ArrayBufferLike>;
  photoUrl?: string;
  /**
   * Квитанция, уже лежащая на серверах Telegram. Заливать её в каждое
   * сообщение заново незачем: file_id переиспользуется в editMessageMedia и
   * переживает пересоздание контейнера, в отличие от файла на диске.
   */
  fileId?: string;
}
