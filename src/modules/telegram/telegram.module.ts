import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { UserModule } from '../user/user.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MenuActions } from './menu/menu.actions';
import { RatesActions } from './rates/rates.actions';
import { RatesModule } from '../rates/rates.module';
import { UserActions } from './user/user.actions';
import { CreateRatesScene } from './rates/rates.scene';
import { VendorModule } from '../vendor/vendor.module';
import { UtilsModule } from '../utils/utils.module';
import { RequestModule } from '../request/request.module';
import { CreateRequestWizard } from './request/request.scene';
import { RequestActions } from './request/request.actions';
import PaymentWizard from './paymnet/paymnet.scene';
import { ReportModule } from '../report/report.module';
import { UserVendorWizard } from './menu/user-vendor.wizard';
import { AcceptRequestScene } from './user/accept-request.scene';
import { AccessControlService } from './access-control/access-control.service';
import { VendorCallbackService } from './callback/vendors';
import { CurrencyService } from '../currencie/currencie.service';
import { CurrencyModule } from '../currencie/currencie.module';
import { ExternalApiModule } from '../external-api/external-api.module';
import { PayoutFieldsActions } from './payout-fields/payout-fields.actions';
import { BoxApiService } from '../payout-fields/box-api.service';
import { AdminGuard } from './admin.guard';
import { WorkGroupService } from './work-group.service';
import { TelegramController } from './telegram.controller';
import { RequestCompleteController } from './request-complete.controller';

@Module({
  imports: [
    UserModule,
    PrismaModule,
    RatesModule,
    VendorModule,
    UtilsModule,
    RequestModule,
    ReportModule,
    CurrencyModule,
    ExternalApiModule,
  ],
  // Эндпоинт ручного закрытия живёт здесь, а не в RequestModule: ему нужен
  // TelegramService, а тот уже импортирует RequestModule — обратная связь
  // замкнула бы модули в кольцо.
  controllers: [RequestCompleteController],
  exports: [TelegramService, WorkGroupService],
  providers: [
    TelegramService,
    CreateRatesScene,
    CreateRequestWizard,
    PaymentWizard,
    UserVendorWizard,
    RequestActions,
    MenuActions,
    RatesActions,
    UserActions,
    CurrencyService,
    AcceptRequestScene,
    AccessControlService,
    VendorCallbackService,
    PayoutFieldsActions,
    BoxApiService,
    AdminGuard,
    WorkGroupService,
    // @Update-класс: без регистрации в DI nestjs-telegraf его не видит и
    // курс бухгалтера в чужой визард не доходит вообще.
    TelegramController,
  ],
})
export class TelegramModule {}
