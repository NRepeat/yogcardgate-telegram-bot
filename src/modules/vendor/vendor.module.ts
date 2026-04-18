import { Module } from '@nestjs/common';
import { VendorService } from './vendor.service';
import { VendorApiController } from './vendor.api.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { VendorRepository } from './vendor.repo';

@Module({
  imports: [PrismaModule],
  controllers: [VendorApiController],
  providers: [VendorService, VendorRepository],
  exports: [VendorService],
})
export class VendorModule {}
