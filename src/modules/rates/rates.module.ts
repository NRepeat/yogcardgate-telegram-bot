import { Module, forwardRef } from '@nestjs/common';
import RatesRepository from './rates.repo';
import { RatesService } from './rates.service';
import { PrismaModule } from '../prisma/prisma.module';
import { VendorModule } from '../vendor/vendor.module';
import { UtilsModule } from '../utils/utils.module';
@Module({
  imports: [
    PrismaModule,
    VendorModule,
    forwardRef(() => UtilsModule),
  ],
  controllers: [],
  providers: [RatesRepository, RatesService],
  exports: [RatesRepository, RatesService],
})
export class RatesModule {}
