import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CurrencyService } from './currencie.service';

@Module({
  imports: [PrismaModule],
  controllers: [],
  providers: [CurrencyService],
  exports: [CurrencyService],
})
export class CurrencyModule {}
