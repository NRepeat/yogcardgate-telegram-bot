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
          if (requests[i].methods?.some(method => method.method === 'QR')) {
            let photoUrl = './src/assets/0056.jpg'; 
            try {
              const messages = await this.requestService.getAllPublicMessagesWithRequestsId(requests[i].id);
              if (messages && messages.length > 0) {
                const messageWithPhoto = messages.find(msg => msg.photoUrl && msg.photoUrl !== '');
                if (messageWithPhoto && messageWithPhoto.photoUrl) {
                  if (messageWithPhoto.photoUrl.startsWith('https://api.telegram.org/file/bot')) {
                    console.warn('Found old Telegram CDN URL in database, using default image');
                    photoUrl = './src/assets/0056.jpg';
                  } else {
                    photoUrl = messageWithPhoto.photoUrl;
                  }
                }
              }
            } catch (error) {
              console.warn('Failed to retrieve photo from database for QR admin message, using default:', error);
            }
            adminMessage.photoUrl = photoUrl;
          }
          await this.telegramService.sendPhotoMessageToAllAdmins(
            adminMessage,
            requests[i].id,
          );
        } else {
          let adminPhotoUrl = photoUrl; // default fallback
          try {
            const messages = await this.requestService.getAllPublicMessagesWithRequestsId(requests[i].id);
            if (messages && messages.length > 0) {
              const messageWithPhoto = messages.find(msg => msg.photoUrl && msg.photoUrl !== '');
              if (messageWithPhoto && messageWithPhoto.photoUrl) {
                if (messageWithPhoto.photoUrl.startsWith('https://api.telegram.org/file/bot')) {
                  console.warn('Found old Telegram CDN URL in database, using default image');
                  adminPhotoUrl = photoUrl; 
                } else {
                  adminPhotoUrl = messageWithPhoto.photoUrl;
                }
              }
            }
          } catch (error) {
            console.warn('Failed to retrieve photo from database for admin message, using default:', error);
          }
          
          const adminMenu = MenuFactory.createAdminMenu(
            requests[i] as unknown as FullRequestType,
            adminPhotoUrl,
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
