import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTokenGuard } from '../request/api-token.guard';
import { PrismaService } from '../prisma/prisma.service';

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
