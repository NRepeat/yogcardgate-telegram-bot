import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PayoutFieldsTokenGuard } from './payout-fields.guard';
import {
  PAYOUT_FIELD_KEYS,
  isPayoutFieldKey,
  matchPreset,
} from './payout-fields.constants';

type PresetBody = { fields?: unknown; enabled?: boolean; note?: string };

const normalize = (fields: unknown): string[] => {
  if (!Array.isArray(fields)) {
    throw new HttpException('fields must be an array', HttpStatus.BAD_REQUEST);
  }
  const bad = fields.filter((f) => !isPayoutFieldKey(f));
  if (bad.length) {
    throw new HttpException(
      `unknown field keys: ${bad.join(', ')}. allowed: ${PAYOUT_FIELD_KEYS.join(', ')}`,
      HttpStatus.BAD_REQUEST,
    );
  }
  return [...new Set(fields as string[])];
};

@Controller('api/payout-fields')
@UseGuards(PayoutFieldsTokenGuard) // весь ресурс под токеном, включая чтение
export class PayoutFieldsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Справочник ключей для админки/подсказок. */
  @Get('keys')
  keys() {
    return { keys: PAYOUT_FIELD_KEYS };
  }

  /** Читает payout-плагин обменника: заголовок x-api-token обязателен. */
  @Get(':xml')
  async getOne(@Param('xml') xml: string) {
    const all = await this.prisma.payoutFieldPreset.findMany({
      where: { enabled: true },
    });
    const preset = matchPreset(all, xml);
    if (!preset) {
      throw new HttpException('preset not found', HttpStatus.NOT_FOUND);
    }
    return { xml: preset.xml, fields: preset.fields, updatedAt: preset.updatedAt };
  }

  @Get()
  async list() {
    return this.prisma.payoutFieldPreset.findMany({ orderBy: { xml: 'asc' } });
  }

  @Put(':xml')
  async upsert(@Param('xml') xml: string, @Body() body: PresetBody) {
    const key = xml.toUpperCase();
    const fields = normalize(body.fields);
    const data = { fields, enabled: body.enabled ?? true, note: body.note ?? null };
    return this.prisma.payoutFieldPreset.upsert({
      where: { xml: key },
      create: { xml: key, ...data },
      update: data,
    });
  }

  @Delete(':xml')
  async remove(@Param('xml') xml: string) {
    await this.prisma.payoutFieldPreset.delete({ where: { xml: xml.toUpperCase() } });
    return { deleted: xml.toUpperCase() };
  }
}
