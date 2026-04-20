import { Injectable } from '@nestjs/common';
import {
  CardRequestType,
  IbanRequestType,
  SerializedMessage,
} from 'src/types/types';
import { PrismaService } from '../prisma/prisma.service';
import { CardPaymentRequestsMethod, PaymentMethodEnum, Status } from '@prisma/client';

export interface PaymentMethodDetailsInput {
  method: PaymentMethodEnum;
  card?: {
    card: string;
    holder?: string | null;
    comment?: string | null;
    bankId?: string | null;
    blackListId?: string | null;
  };
  iban?: {
    iban: string;
    inn: string | null;
    name?: string | null;
    comment?: string | null;
  };
  bank?: {
    account: string;
    recipient: string;
    bankName?: string | null;
    comment?: string | null;
  };
  phone?: {
    phoneNumber: string;
    holderName?: string | null;
    comment?: string | null;
  };
  skrill?: {
    email: string;
    comment?: string | null;
  };
  payoneer?: {
    email: string;
    comment?: string | null;
  };
  qr?: {
    identifier: string;
    comment?: string | null;
  };
  wise?: {
    email: string;
    fullName: string;
    cardNumber?: string | null;
    comment?: string | null;
  };
  paypal?: {
    email: string;
    fullName: string;
    comment?: string | null;
  };
}

export interface GeneralRequestCreateInput {
  amount: number;
  vendorId: string;
  currencyId: string;
  rateId: string;
  rate: string;
  method: PaymentMethodDetailsInput;
}

const PAYMENT_REQUEST_DEFAULT_INCLUDE = {
  paymentMethod: true,
  message: true,
  vendor: true,
  rates: true,
  currency: true,
  user: true,
  adminRequestPhotoMessage: true,
  activeUser: true,
  payedByUser: true,
  methods: {
    include: {
      cardDetails: {
        include: {
          blackList: true,
          bank: true,
        },
      },
      ibanDetails: true,
      bankDetails: true,
      phoneDetails: true,
      skrillDetails: true,
      payoneerDetails: true,
      qrDetails: true,
      wiseDetails: true,
      paypalDetails: true,
    },
  },
} as const;

const buildMethodCreateInput = (details: PaymentMethodDetailsInput) => {
  console.log('details.method', details.method);
  switch (details.method) {
    case PaymentMethodEnum.CARD:
    case PaymentMethodEnum.KZT_KASPI_BANK:
    case PaymentMethodEnum.KZT_OTHER_BANKS:
    case PaymentMethodEnum.CNY_CARD:
      if (!details.card) {
        throw new Error('Card details are required for CARD method');
      }
      return {
        method: details.method,
        cardDetails: {
          create: {
            card: details.card.card,
            holder: details.card.holder ?? null,
            comment: details.card.comment ?? null,
            bankId: details.card.bankId ?? null,
            blackList: details.card.blackListId
              ? {
                  connect: {
                    id: details.card.blackListId,
                  },
                }
              : undefined,
          },
        },
      };
    case PaymentMethodEnum.IBAN:
      if (!details.iban) {
        throw new Error('IBAN details are required for IBAN method');
      }
      return {
        method: details.method,
        ibanDetails: {
          create: {
            iban: details.iban.iban,
            inn: details.iban.inn,
            name: details.iban.name ?? null,
            comment: details.iban.comment ?? null,
          },
        },
      };
    case PaymentMethodEnum.WISE:
      if (!details.wise) {
        throw new Error('Wise details are required for WISE method');
      }
      return {
        method: details.method,
        wiseDetails: {
          create: {
            email: details.wise.email,
            fullName: details.wise.fullName,
            cardNumber: details.wise.cardNumber ?? null,
            comment: details.wise.comment ?? null,
          },
        },
      };
    case PaymentMethodEnum.PAYPAL:
      if (!details.paypal) {
        throw new Error('PayPal details are required for PAYPAL method');
      }
      return {
        method: details.method,
        paypalDetails: {
          create: {
            email: details.paypal.email,
            fullName: details.paypal.fullName,
            comment: details.paypal.comment ?? null,
          },
        },
      };
    case PaymentMethodEnum.BANK:
      if (!details.bank) {
        throw new Error('Bank details are required for bank method');
      }
      return {
        method: details.method,
        bankDetails: {
          create: {
            account: details.bank.account,
            recipient: details.bank.recipient,
            bankName: details.bank.bankName ?? null,
            comment: details.bank.comment ?? null,
          },
        },
      };
    case PaymentMethodEnum.PHONE:
      if (!details.phone) {
        throw new Error('Phone details are required for phone method');
      }
      return {
        method: details.method,
        phoneDetails: {
          create: {
            phoneNumber: details.phone.phoneNumber,
            holderName: details.phone.holderName ?? null,
            comment: details.phone.comment ?? null,
          },
        },
      };
    case PaymentMethodEnum.SKRILL:
      if (!details.skrill) {
        throw new Error('Skrill details are required for Skrill method');
      }
      return {
        method: details.method,
        skrillDetails: {
          create: {
            email: details.skrill.email,
            comment: details.skrill.comment ?? null,
          },
        },
      };
    case PaymentMethodEnum.PAYONEER:
      if (!details.payoneer) {
        throw new Error('Payoneer details are required for Payoneer method');
      }
      return {
        method: details.method,
        payoneerDetails: {
          create: {
            email: details.payoneer.email,
            comment: details.payoneer.comment ?? null,
          },
        },
      };
    case PaymentMethodEnum.QR:
    case PaymentMethodEnum.CNY_ALIPAY:
    case PaymentMethodEnum.CNY_WECHAT:
      if (!details.qr) {
        throw new Error('QR details are required for QR method');
      }
      return {
        method: details.method,
        qrDetails: {
          create: {
            identifier: details.qr.identifier,
            comment: details.qr.comment ?? null,
          },
        },
      };
    case PaymentMethodEnum.CNY_ACCOUNT:
      if (!details.bank) {
        throw new Error('Bank details are required for CNY_ACCOUNT method');
      }
      return {
        method: details.method,
        bankDetails: {
          create: {
            account: details.bank.account,
            recipient: details.bank.recipient,
            bankName: details.bank.bankName ?? null,
            comment: details.bank.comment ?? null,
          },
        },
      };
    default:
      return {
        method: details.method,
      };
  }
};

@Injectable()
export class RequestRepository {
  constructor(private readonly prisma: PrismaService) {}
  async unlinkUser(requestId: string) {
    await this.prisma.paymentRequests.update({
      where: { id: requestId },
      data: { userId: null, activeUserId: null },
    });
  }
  async updateRequestNotificationStatus(requestId: string, sended: boolean) {
    await this.prisma.paymentRequests.update({
      where: { id: requestId },
      data: { notificationSent: sended },
    });
  }
  async removeFromBlackList(id: string) {
    return this.prisma.blackList.delete({
      where: { id },
    });
  }
  async findBlackListByCardNumber(cardNumber: string) {
    return this.prisma.blackList.findFirst({
      where: {
        OR: [
          { cardNumber: cardNumber },
          {
            card: {
              some: {
                card: cardNumber,
              },
            },
          },
        ],
      },
      include: {
        card: true,
      },
    });
  }
  async getBlackList() {
    return this.prisma.blackList.findMany({
      include: {
        card: true,
      },
    });
  }
  async findCardPaymentByCardNumber(cardNumber: string) {
    return this.prisma.paymentRequests.findFirst({
      where: {
        methods: {
          some: {
            method: PaymentMethodEnum.CARD,
            cardDetails: {
              is: {
                card: cardNumber,
              },
            },
          },
        },
      },
      include: PAYMENT_REQUEST_DEFAULT_INCLUDE,
    });
  }
  async addToBlackList(data: {
    cardNumber: string;
    comment?: string;
    methodId?: string;
  }) {
    return this.prisma.blackList.create({
      data: {
        cardNumber: data.cardNumber,
        reason: data.comment,
        ...(data.methodId
          ? {
              card: {
                connect: {
                  id: data.methodId,
                },
              },
            }
          : {}),
      },
    });
  }
  async getAllPublicMessagesWithRequestsId(
    requestId: string,
  ): Promise<SerializedMessage[]> {
    if (!requestId) {
      throw new Error('Request ID is required');
    }
    return this.prisma.message.findMany({
      where: { requestId, accessType: 'PUBLIC' },
      orderBy: { createdAt: 'asc' },
      include: {
        paymentRequests: {
          include: {
            vendor: true,
          },
        },
      },
    });
  }
  async findAndDeleteRequestMessageByRequestId(
    requestId: string,
    messageId: number,
  ) {
    return this.prisma.message.deleteMany({
      where: { messageId, requestId },
    });
  }
  async updateRequestStatus(
    requestId: string,
    status: Status,
    userId: string,
  ): Promise<void> {
    await this.prisma.paymentRequests.update({
      where: { id: requestId },
      data: {
        status,
        payedByUser: {
          connect: { id: userId },
        },
        completedAt: status === 'COMPLETED' ? new Date() : null,
      },
    });
  }

  async createIbanRequest(data: IbanRequestType) {
    return this.prisma.paymentRequests.create({
      data: {
        amount: data.amount || 0,
        vendor: { connect: { id: data.vendorId } },
        currency: { connect: { id: data.currencyId } },
        rates: {
          connect: { id: data.rateId },
        },
        paymentMethod: {
          connect: {
            nameEn: 'IBAN',
          },
        },
        methods: {
          create: {
            method: PaymentMethodEnum.IBAN,
            ibanDetails: {
              create: {
                ...data.iban,
              },
            },
          },
        },
      },
      include: PAYMENT_REQUEST_DEFAULT_INCLUDE,
    });
  }
  async getAllRequests() {
    return this.prisma.paymentRequests.findMany({
      include: PAYMENT_REQUEST_DEFAULT_INCLUDE,
    });
  }

  async isInBlackList(cardNumber: string) {
    return this.prisma.blackList.findFirst({
      where: { card: { some: { card: cardNumber } } },
    });
  }
  async acceptRequest(requestId: string, userId: string): Promise<boolean> {
    const result = await this.prisma.paymentRequests.updateMany({
      where: {
        id: requestId,
        status: 'PENDING',
        activeUserId: null,
      },
      data: {
        status: 'ACCEPTED',
        activeUserId: userId,
      },
    });
    return result.count > 0;
  }
  async findAllNotProcessedRequests() {
    return this.prisma.paymentRequests.findMany({
      where: {
        userId: null,
        notificationSent: false,
      },
      include: PAYMENT_REQUEST_DEFAULT_INCLUDE,
    });
  }
  createCardRequest({ data }: { data: CardRequestType }) {
    return this.createGeneralRequest({
      amount: data.amount,
      vendorId: data.vendorId,
      currencyId: data.currencyId,
      rateId: data.rateId,
      rate: data.rate ?? '',
      method: {
        method: PaymentMethodEnum.CARD,
        card: {
          card: data.card.card,
          comment: data.card.comment ?? null,
          bankId: data.card.bankId ?? null,
          blackListId: data.blackList?.id ?? null,
        },
      },
    });
  }

  createGeneralRequest(data: GeneralRequestCreateInput) {
    return this.prisma.paymentRequests.create({
      data: {
        amount: data.amount,
        vendor: { connect: { id: data.vendorId } },
        currency: { connect: { id: data.currencyId } },
        rates: {
          connect: { id: data.rateId },
        },
        paymentMethod: {
          connect: {
            nameEn: data.method.method,
          },
        },
        rate: data.rate,
        methods: {
          create: buildMethodCreateInput(data.method),
        },
      },
      include: PAYMENT_REQUEST_DEFAULT_INCLUDE,
    });
  }

  async findAll() {
    return this.prisma.paymentRequests.findMany();
  }

  async findOne(id: string) {
    return this.prisma.paymentRequests.findUnique({
      where: { id },
      include: PAYMENT_REQUEST_DEFAULT_INCLUDE,
    });
  }

  async findAllCardRequestsByCard(cardNumber?: string) {
    return this.prisma.paymentRequests.findMany({
      where: cardNumber
        ? {
            methods: {
              some: {
                method: PaymentMethodEnum.CARD,
                cardDetails: {
                  is: {
                    card: cardNumber,
                  },
                },
              },
            },
          }
        : undefined,
      include: PAYMENT_REQUEST_DEFAULT_INCLUDE,
    });
  }
  async insertCardRequestMessage(
    requestId: string,
    message: SerializedMessage,
  ) {
    return this.prisma.paymentRequests.update({
      where: { id: requestId },
      data: {
        message: {
          create: {
            chatId: message.chatId,
            messageId: message.messageId,
            text: message.text,
            photoUrl: message.photoUrl || '',
            accessType: message.accessType,
          },
        },
      },
    });
  }
  async getRequestsForVendorBetween(vendorId: string, from: Date, to: Date) {
    return this.prisma.paymentRequests.findMany({
      where: {
        status: 'COMPLETED',
        vendorId,
        createdAt: {
          gte: from,
          lte: to,
        },
      },
      include: {
        ...PAYMENT_REQUEST_DEFAULT_INCLUDE,
      },
    });
  }
  // async create(data: SerializedRequest) {
  //   return this.prisma.paymentRequests.create({ data:{} });
  // }

  // async update(id: number, data: any) {
  //   return this.prisma.request.update({ where: { id }, data });
  // }

  // async delete(id: number) {
  //   return this.prisma.request.delete({ where: { id } });
  // }
}
