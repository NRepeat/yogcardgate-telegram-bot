import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Query,
  Param,
} from '@nestjs/common';
import { ApiTokenGuard } from './api-token.guard';
import { RequestService } from './request.service';
import { RatesService } from '../rates/rates.service';
import { CardRequestType, IbanRequestType } from 'src/types/types';
import { VendorService } from '../vendor/vendor.service';
import { ApiToken } from './api-token.decorator';
import { PaymentMethodEnum } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Utility to convert BigInt to string in all responses
function replacerBigInt(key: string, value: any) {
  return typeof value === 'bigint' ? value.toString() : value;
}
function toJSONSafe(obj: any) {
  return JSON.parse(JSON.stringify(obj, replacerBigInt));
}

@Controller('api/request')
@UseGuards(ApiTokenGuard)
export class RequestApiController {
  constructor(
    private readonly requestService: RequestService,
    private readonly ratesService: RatesService,
    private readonly vendorService: VendorService,
    private readonly prismaService: PrismaService,
  ) {}

  @Get('admin/dashboard')
  async getDashboard() {
    const requests = await this.prismaService.paymentRequests.findMany({
      include: { currency: true, paymentMethod: true },
      orderBy: { createdAt: 'desc' },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const completed = requests.filter((r) => r.status === 'COMPLETED');
    const failed = requests.filter((r) => r.status === 'FAILED');
    const pending = requests.filter((r) => r.status === 'PENDING' || r.status === 'ACCEPTED');
    const todayReqs = requests.filter((r) => new Date(r.createdAt) >= today);
    const todayCompleted = completed.filter((r) => r.completedAt && new Date(r.completedAt) >= today);

    // Avg completion time in minutes
    const completionTimes = completed
      .filter((r) => r.completedAt)
      .map((r) => (new Date(r.completedAt!).getTime() - new Date(r.createdAt).getTime()) / 60000);
    const avgCompletionMinutes = completionTimes.length > 0
      ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length)
      : 0;

    // Daily data (last 30 days)
    const dailyMap = new Map<string, { count: number; volume: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dailyMap.set(d.toISOString().slice(0, 10), { count: 0, volume: 0 });
    }
    for (const r of requests) {
      const key = new Date(r.createdAt).toISOString().slice(0, 10);
      if (dailyMap.has(key)) {
        const entry = dailyMap.get(key)!;
        entry.count++;
        entry.volume += r.amount;
      }
    }
    const dailyData = [...dailyMap.entries()].map(([date, d]) => ({ date, ...d }));

    // By currency
    const currMap = new Map<string, { count: number; volume: number }>();
    for (const r of requests) {
      const key = r.currency?.nameEn || 'Unknown';
      const entry = currMap.get(key) || { count: 0, volume: 0 };
      entry.count++;
      entry.volume += r.amount;
      currMap.set(key, entry);
    }
    const byCurrency = [...currMap.entries()].map(([currency, d]) => ({ currency, ...d }));

    // By method
    const methodMap = new Map<string, { count: number; volume: number }>();
    for (const r of requests) {
      const key = r.paymentMethod?.nameEn || 'Unknown';
      const entry = methodMap.get(key) || { count: 0, volume: 0 };
      entry.count++;
      entry.volume += r.amount;
      methodMap.set(key, entry);
    }
    const byMethod = [...methodMap.entries()].map(([method, d]) => ({ method, ...d }));

    // By status
    const statusMap = new Map<string, number>();
    for (const r of requests) {
      statusMap.set(r.status, (statusMap.get(r.status) || 0) + 1);
    }
    const byStatus = [...statusMap.entries()].map(([status, count]) => ({ status, count }));

    return {
      totalRequests: requests.length,
      completedRequests: completed.length,
      failedRequests: failed.length,
      pendingRequests: pending.length,
      totalVolume: completed.reduce((s, r) => s + r.amount, 0),
      todayRequests: todayReqs.length,
      todayVolume: todayCompleted.reduce((s, r) => s + r.amount, 0),
      successRate: requests.length > 0 ? Math.round((completed.length / requests.length) * 100) : 0,
      avgCompletionMinutes,
      dailyData,
      byCurrency,
      byMethod,
      byStatus,
    };
  }

  @Post('add_lead')
  async addLead(
    @Body() requests: CardRequestType[],
    @ApiToken() apiToken: string,
  ) {
    // Check if bot is on pause
    const settings = await this.prismaService.settings.findUnique({
      where: { name: 'default' },
    });

    if (settings?.onPause) {
      return {
        error: 'В данный момент мы не принимаем заявки, вы получите уведомление как только мы возобновим работу.',
        status: 2215,
      };
    }

    // console.log('Received requests:', requests);
    const responses: any[] = [];
    for (const req of requests) {
      const result: Record<string, any> = {
        amount: req.amount,
        cardNumber: req.card.card,
      };
      // Card number validation (16 digits, Luhn)
      const cardNumber = req.card.card.replace(/\s/g, '');
      // console.log(`Validating card number: ${cardNumber}`);
      // Check if card number is valid: 16 digits and Luhn algorithm
      if (
        !cardNumber ||
        !/^\d{16}$/.test(cardNumber)
        // !this.isValidLuhn(cardNumber)
      ) {
        result.error =
          'Некорректный номер карты (ожидается 16 цифр и валидность по Luhn)';
        result.status = 2215;
        responses.push(result);
        continue;
      }
      // Rate lookup
      const allRates = await this.ratesService.getAllEnabledRates();
      const amount = req.amount;
      let rate: number | null = null;
      for (const r of allRates) {
        if (r.paymentMethod.nameEn.toLowerCase() === 'card') {
          const min = r.minAmount;
          const max = r.maxAmount;
          const greaterOrEqualMin = amount >= min;
          const lessOrEqualMax =
            max === null || max === 0 ? true : amount <= max;
          if (greaterOrEqualMin && lessOrEqualMax) {
            rate = r.rate;
            break;
          }
        }
      }
      if (!rate || rate === 0) {
        result.status = 2215;
        result.error = 'Нет подходящего курса для суммы или курс равен 0';
        responses.push(result);
        continue;
      }
      const foundRate = allRates.find(
        (r) =>
          r.rate === rate && r.paymentMethod.nameEn.toLowerCase() === 'card',
      );
      req.rateId = foundRate?.id || '';
      result.rate = rate;
      // Save request
      try {
        const vendor = await this.vendorService.getVendorByToken(apiToken);
        // console.log(`Creating request for vendor: ${vendor?.title}`);
        if (!vendor) {
          result.status = 2215;
          result.error = 'Неверный API токен или вендор не найден';
          responses.push(result);
          continue;
        }
        req.vendorId = vendor.id;
        req.currencyId = foundRate?.currency.id || '';
        const created = await this.requestService.createCardRequest(req);
        result.status = 2200;
        result.hexRequestNumber = created.id;
      } catch (e) {
        // console.error('Error creating request:', e);
        result.status = 2215;
        result.error = 'Ошибка при создании заявки';
      }
      responses.push(result);
    }
    return toJSONSafe(responses);
  }

  @Post('add_iban_lead')
  async addIbanLead(
    @Body() requests: IbanRequestType[],
    @ApiToken() apiToken: string,
  ) {
    // Check if bot is on pause
    const settings = await this.prismaService.settings.findUnique({
      where: { name: 'default' },
    });

    if (settings?.onPause) {
      return {
        error: 'В данный момент мы не принимаем заявки, вы получите уведомление как только мы возобновим работу.',
        status: 2215,
      };
    }

    const responses: any[] = [];
    for (let i = 0; i < requests.length; i++) {
      const req = requests[i];
      const result: Record<string, any> = {
        amount: req.amount,
        iban: req.iban?.iban,
        inn: req.iban?.inn,
        client_name: req.iban?.name,
        comment: req.iban?.comment,
      };
      // IBAN validation
      if (!req.iban?.iban || req.iban.iban.length !== 29) {
        result.error = `IBAN должен быть ровно 29 символов (элемент ${i + 1})`;
        result.status = 2215;
        responses.push(result);
        continue;
      }
      if (
        !req.iban?.inn ||
        req.iban.inn.length < 8 ||
        req.iban.inn.length > 10
      ) {
        result.error = `ИНН должен быть от 8 до 10 символов (элемент ${i + 1})`;
        result.status = 2215;
        responses.push(result);
        continue;
      }
      // Rate lookup
      const allRates = await this.ratesService.getAllEnabledRates();
      const amount = req.amount;
      let rate: number | null = null;
      for (const r of allRates) {
        if (r.paymentMethod.nameEn.toLowerCase() === 'iban') {
          const min = r.minAmount;
          const max = r.maxAmount;
          const greaterOrEqualMin = amount >= min;
          const lessOrEqualMax =
            max === null || max === 0 ? true : amount <= max;
          if (greaterOrEqualMin && lessOrEqualMax) {
            rate = r.rate;
            break;
          }
        }
      }
      if (!rate || rate === 0) {
        result.status = 2215;
        result.error = 'Нет подходящего курса для суммы или курс равен 0';
        responses.push(result);
        continue;
      }
      const foundRate = allRates.find(
        (r) =>
          r.rate === rate && r.paymentMethod.nameEn.toLowerCase() === 'iban',
      );
      req.rateId = foundRate?.id || '';
      result.rate = rate;
      // Save request
      try {
        const vendor = await this.vendorService.getVendorByToken(apiToken);
        // console.log(`Creating request for vendor: ${vendor?.title}`);
        if (!vendor) {
          result.status = 2215;
          result.error = 'Неверный API токен или вендор не найден';
          responses.push(result);
          continue;
        }
        req.vendorId = vendor.id;
        req.currencyId = foundRate?.currency.id || '';
        const created = await this.requestService.createIbanRequest(req);
        result.status = 2200;
        result.hexRequestNumber = created.id;
      } catch (e) {
        result.status = 2215;
        result.error = 'Ошибка при создании заявки';
      }
      responses.push(result);
    }
    return toJSONSafe(responses);
  }

  @Get('admin/list')
  async getAdminRequests(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const take = Math.min(parseInt(limit || '50', 10), 100);
    const skip = (Math.max(parseInt(page || '1', 10), 1) - 1) * take;

    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const [requests, total] = await Promise.all([
      this.prismaService.paymentRequests.findMany({
        where,
        include: {
          currency: true,
          vendor: true,
          activeUser: true,
          payedByUser: true,
          paymentMethod: true,
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prismaService.paymentRequests.count({ where }),
    ]);

    return toJSONSafe({
      data: requests.map((r) => ({
        id: r.id,
        amount: r.amount,
        status: r.status,
        currency: r.currency?.nameEn || '',
        method: r.paymentMethod?.nameEn || '',
        vendor: r.vendor?.title || '',
        worker: r.activeUser?.username || '',
        payedBy: r.payedByUser?.username || '',
        rate: r.rate || '',
        createdAt: r.createdAt,
        completedAt: r.completedAt,
      })),
      total,
      page: Math.max(parseInt(page || '1', 10), 1),
      pages: Math.ceil(total / take),
    });
  }

  @Get('get_leads')
  async getLeads(
    @Query('id') id?: string,
    @Query('ids') ids?: string[],
    @Query('status') status?: string,
  ) {
    // For demo: just return all requests, optionally filter by id/ids/status
    let requests = await this.requestService.getAllRequests();
    if (id) {
      requests = requests.filter((r) => r.id === id);
    } else if (ids && ids.length > 0) {
      requests = requests.filter((r) => ids.includes(r.id));
    } else if (status !== undefined) {
      requests = requests.filter((r) => String(r.status) === status);
    }
    return toJSONSafe(requests);
  }

  @Get(':id/status')
  async getRequestStatus(@Param('id') id: string) {
    const request = await this.requestService.findById(id);
    if (!request) {
      return {
        statusCode: 2204,
        status: 'not_found',
        error: `Заявка с ID ${id} не найдена`,
      };
    }
    // Map status to response
    // Use user/activeUser for accepted/success
    if (request.activeUser && Number(request.status) === 1) {
      return toJSONSafe({
        status: 2201,
        message: `Ваш статус заявки: Завершена пользователем @${request.activeUser.username}`,
        username: request.activeUser.username,
        stage: 'Завершена',
        datetime: request.updatedAt || null,
      });
    } else if (request.activeUser) {
      return toJSONSafe({
        status: 2211,
        message: `Ваш статус заявки: Принята пользователем @${request.activeUser.username}`,
        username: request.activeUser.username,
        stage: 'Принята',
        datetime: null,
      });
    } else if (Number(request.status) === 5) {
      return toJSONSafe({
        status: 2205,
        message: `Ваш статус заявки: Ошибка - ${request.error || 'Заявка не принята'}`,
        username: null,
        stage: 'Ошибка',
        datetime: null,
      });
    } else {
      return toJSONSafe({
        status: 2200,
        message: 'Ваш статус заявки: Ожидание',
        username: null,
        stage: 'Ожидание',
        datetime: null,
      });
    }
  }

  @Get('status-by-date')
  async getStatusByDate(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    // For demo: just return all requests in date range
    const from = new Date(startDate);
    const to = new Date(endDate);
    const requests = await this.requestService.getAllRequests();
    const filtered = requests.filter((r) => {
      const created = new Date(r.createdAt);
      return created >= from && created <= to;
    });
    return toJSONSafe(
      filtered.map((request) => {
        const cardMethod = request.methods?.find(
          (method) => method.method === PaymentMethodEnum.CARD,
        );
        const ibanMethod = request.methods?.find(
          (method) => method.method === PaymentMethodEnum.IBAN,
        );

        return {
          hexRequestNumber: request.id,
          amount: request.amount,
          cardNumber: cardMethod?.cardDetails?.card ?? null,
          iban: ibanMethod?.ibanDetails?.iban ?? null,
          clientName: ibanMethod?.ibanDetails?.name ?? null,
          inn: ibanMethod?.ibanDetails?.inn ?? null,
          comment: ibanMethod?.ibanDetails?.comment ?? null,
          rate: request.rates?.rate,
          datetime: request.updatedAt || null,
          status: request.status,
        };
      }),
    );
  }

  @Get('rates')
  async getRates() {
    const allRates = await this.ratesService.getAllEnabledRates();
    const cardRates = allRates.filter(
      (r) => r.paymentMethod.nameEn.toLowerCase() === 'card',
    );
    const ibanRates = allRates.filter(
      (r) => r.paymentMethod.nameEn.toLowerCase() === 'iban',
    );
    return toJSONSafe({
      cardRates,
      ibanRates,
    });
  }

  @Get('rates/all')
  async getAllRates() {
    const allRates = await this.ratesService.getAllEnabledRates();
    const grouped: Record<string, any[]> = {};
    for (const r of allRates) {
      const method = r.paymentMethod.nameEn.toUpperCase();
      if (!grouped[method]) grouped[method] = [];
      grouped[method].push(r);
    }
    return toJSONSafe(grouped);
  }
}
