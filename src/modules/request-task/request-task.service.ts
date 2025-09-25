import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RequestService } from '../request/request.service';
import { TelegramService } from '../telegram/telegram.service';
import { FullRequestType, ReplyPhotoMessage } from 'src/types/types';
import { UserService } from '../user/user.service';
import { InjectBot } from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';
import { MenuFactory } from '../telegram/telegram-keyboards';
import { RequestMessageFactory } from '../telegram/request/request-message.factory';
const photoUrl = './src/assets/0056.jpg';

@Injectable()
export class RequestTaskService {
  private readonly logger = new Logger('RequestTaskService');
  constructor(
    private readonly requestService: RequestService,
    private readonly telegramService: TelegramService,
  ) {}
  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleRequests() {
    try {
      const requests =
        (await this.requestService.findAllNotProcessedRequests()) as FullRequestType[];
      if (requests.length === 0) return;
      for (let i = 0; i < requests.length; i++) {
        await this.telegramService.sendRequestToWorkGroup(requests[i]);
        const adminMessage =
          requests[i].methods?.map((method) =>
            RequestMessageFactory.create('ADMIN', requests[i], method),
          ).find((message) => message !== null) ?? null;

        if (adminMessage) {
          await this.telegramService.sendPhotoMessageToAllAdmins(
            adminMessage,
            requests[i].id,
          );
        } else {
          const adminMenu = MenuFactory.createAdminMenu(
            requests[i] as unknown as FullRequestType,
            photoUrl,
          );
          const fallbackMessage: ReplyPhotoMessage = {
            photoUrl: adminMenu.inWork().url,
            text: adminMenu.inWork().caption,
            inline_keyboard: adminMenu.inWork().markup,
          };
          await this.telegramService.sendPhotoMessageToAllAdmins(
            fallbackMessage,
            requests[i].id,
          );
        }
        await this.requestService.updateRequestNotificationStatus(
          requests[i].id,
          true,
        );
      }
    } catch (error) {
      this.logger.error('Error while processing requests', error);
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async sendNotification() {
    const requests =
      (await this.requestService.getAllRequests()) as FullRequestType[];
    if (requests.length === 0) {
      return;
    }
    await this.telegramService.notificateToWorkGroup(requests);
  }
}
