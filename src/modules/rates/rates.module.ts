import { Module, forwardRef } from '@nestjs/common';
import RatesRepository from './rates.repo';
import { RatesService } from './rates.service';
import { PrismaModule } from '../prisma/prisma.module';
import { VendorModule } from '../vendor/vendor.module';
import { UtilsModule } from '../utils/utils.module';
import { ExternalApiModule } from '../external-api/external-api.module';

@Module({
  imports: [
    PrismaModule,
    VendorModule,
    forwardRef(() => UtilsModule),
    ExternalApiModule,
  ],
  controllers: [],
  providers: [RatesRepository, RatesService],
  exports: [RatesRepository, RatesService],
})
export class RatesModule {}
