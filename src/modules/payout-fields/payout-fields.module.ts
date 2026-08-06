import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PayoutFieldsController } from './payout-fields.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PayoutFieldsController],
})
export class PayoutFieldsModule {}
