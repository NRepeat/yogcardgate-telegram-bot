import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Header,
  Headers,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTokenGuard } from '../request/api-token.guard';
import { PrismaService } from '../prisma/prisma.service';

const XML_FROM_CODE = 'USDTTRC20';
// ponytail: no reserve tracking — reuse direction max (or 1M when unbounded) as <amount>
const UNBOUNDED_AMOUNT = 1000000;
// Exchange floor, in USD — the tier every real order is priced at. Keep in sync
// with the minimum set on greatchange (directions.min_amount).
const MIN_ORDER_USD = 350;

type XmlRateRow = {
  xml: string | null;
  rate: number;
  minAmount: number;
  maxAmount: number;
};

export function buildRatesXml(rows: XmlRateRow[], created: string): string {
  const groups = new Map<string, XmlRateRow[]>();
  for (const row of rows) {
    if (!row.xml) continue;
    if (!groups.has(row.xml)) groups.set(row.xml, []);
    groups.get(row.xml)!.push(row);
  }

  const items = Array.from(groups.entries()).map(([code, list]) => {
    // Quote the tier a real order lands in. Any position-based pick (middle,
    // top) hits the wrong band as soon as a method's tiers are laid out
    // differently: the middle of two tiers is the lowest one, and the top of
    // KZT's [9000, 300000] is a tier no order of ours reaches.
    const byMin = [...list].sort((a, b) => a.minAmount - b.minAmount);
    const reference = MIN_ORDER_USD * byMin[0].rate;
    const tier =
      byMin.find(
        (t) =>
          reference >= t.minAmount && (!t.maxAmount || reference <= t.maxAmount),
      ) ?? byMin[0];
    const out = tier.rate;
    const min = Math.min(...list.map((r) => r.minAmount));
    const unbounded = list.some((r) => !r.maxAmount);
    const max = unbounded
      ? UNBOUNDED_AMOUNT
      : Math.max(...list.map((r) => r.maxAmount));
    return [
      '  <item>',
      `    <from>${XML_FROM_CODE}</from>`,
      `    <to>${code}</to>`,
      '    <in>1</in>',
      `    <out>${out}</out>`,
      `    <amount>${max}</amount>`,
      `    <minamount>${min}</minamount>`,
      `    <maxamount>${max}</maxamount>`,
      '    <param/>',
      '  </item>',
    ].join('\n');
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<rates created="${created}">\n${items.join('\n')}\n</rates>`;
}

// Auth per vendor: token must match Vendors.token (header or ?token= for browsers/aggregators)
@Controller('api/rates')
export class RatesXmlController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('export.xml')
  @Header('Content-Type', 'application/xml')
  async exportXml(
    @Headers('x-api-token') headerToken?: string,
    @Headers('x-api-key') headerKey?: string,
    @Query('token') queryToken?: string,
  ): Promise<string> {
    const token = headerToken || headerKey || queryToken;
    const vendor = token
      ? await this.prisma.vendors.findUnique({ where: { token } })
      : null;
    if (!vendor) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
    const rates = await this.prisma.rates.findMany({
      where: { enabled: true, xml: { not: null } },
    });
    return buildRatesXml(rates, new Date().toISOString());
  }
}

@Controller('api/rates')
@UseGuards(ApiTokenGuard)
export class RatesApiController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getRates() {
    const rates = await this.prisma.rates.findMany({
      include: { currency: true, paymentMethod: true },
      orderBy: [{ currency: { name: 'asc' } }, { minAmount: 'desc' }],
    });
    return rates.map((r) => ({
      id: r.id,
      currency: r.currency.name,
      method: r.paymentMethod.nameEn,
      minAmount: r.minAmount,
      maxAmount: r.maxAmount,
      rate: r.rate,
      enabled: r.enabled,
      xml: r.xml,
    }));
  }

  @Put(':id')
  async updateRate(
    @Param('id') id: string,
    @Body() body: { rate?: number; minAmount?: number; maxAmount?: number; enabled?: boolean },
  ) {
    const data: any = {};
    if (body.rate !== undefined) data.rate = body.rate;
    if (body.minAmount !== undefined) data.minAmount = body.minAmount;
    if (body.maxAmount !== undefined) data.maxAmount = body.maxAmount;
    if (body.enabled !== undefined) data.enabled = body.enabled;

    const updated = await this.prisma.rates.update({
      where: { id },
      data,
      include: { currency: true, paymentMethod: true },
    });

    return {
      id: updated.id,
      currency: updated.currency.name,
      method: updated.paymentMethod.nameEn,
      minAmount: updated.minAmount,
      maxAmount: updated.maxAmount,
      rate: updated.rate,
      enabled: updated.enabled,
    };
  }
}
