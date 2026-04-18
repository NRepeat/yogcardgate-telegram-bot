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

@Controller('api/vendors')
@UseGuards(ApiTokenGuard)
export class VendorApiController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getVendors() {
    const vendors = await this.prisma.vendors.findMany({
      orderBy: { title: 'asc' },
    });
    return vendors.map((v) => ({
      id: v.id,
      title: v.title,
      chatId: v.chatId.toString(),
      work: v.work,
      showReceipt: v.showReceipt,
      token: v.token ? '***' + v.token.slice(-4) : null,
    }));
  }

  @Put(':id/work')
  async toggleWork(
    @Param('id') id: string,
    @Body() body: { work: boolean },
  ) {
    const updated = await this.prisma.vendors.update({
      where: { id },
      data: { work: body.work },
    });
    return {
      id: updated.id,
      title: updated.title,
      work: updated.work,
    };
  }

  @Put(':id/receipt')
  async toggleReceipt(
    @Param('id') id: string,
    @Body() body: { showReceipt: boolean },
  ) {
    const updated = await this.prisma.vendors.update({
      where: { id },
      data: { showReceipt: body.showReceipt },
    });
    return {
      id: updated.id,
      title: updated.title,
      showReceipt: updated.showReceipt,
    };
  }
}
