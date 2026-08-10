import { Injectable, Logger } from '@nestjs/common';
import { Context } from 'telegraf';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { UserService } from '../user/user.service';
import { photoSource as photoInput, DEFAULT_PHOTO } from './photo-source';

import {
  FullRequestType,
  ReplyPhotoMessage,
  SerializedMessage,
} from 'src/types/types';
import { RequestService } from '../request/request.service';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import { MenuFactory } from './telegram-keyboards';
import { ConfigService } from '@nestjs/config';
import { CurrencyEnum } from '@prisma/client';
import { RequestMessageFactory } from './request/request-message.factory';

const photoUrl = './src/assets/0056.jpg';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    @InjectBot() private bot: Telegraf<Context>,
    private readonly userService: UserService,
    private readonly requestService: RequestService,
    private readonly configService: ConfigService,
  ) {}

  private lastWorkerIndex = -1;

  /**
   * Check if a chat exists by attempting to get chat information
   */
  async checkChatExists(chatId: number): Promise<boolean> {
    try {
      await this.bot.telegram.getChat(chatId);
      return true;
    } catch (error) {
      this.logger.warn(
        `Chat ${chatId} not found or inaccessible: ${error.message}`,
      );
      return false;
    }
  }
  async updateWorkerMessages(
    requestId: string,
    isWorkGroup = false,
    isHubGroup = false,
  ) {
    try {
      const request = await this.requestService.findById(requestId);
      if (!request) throw new Error('Request not found');
      const messages = request.message.filter((m) => m.accessType === 'WORKER');
      if (messages.length === 0) return;
      for (const message of messages) {
        // Try to get photo URL from database
        let photoUrl = './src/assets/0056.jpg'; // default fallback
        try {
          const dbMessages = await this.requestService.getAllPublicMessagesWithRequestsId(requestId);
          if (dbMessages && dbMessages.length > 0) {
            const messageWithPhoto = dbMessages.find(msg => msg.photoUrl && msg.photoUrl !== '');
            if (messageWithPhoto && messageWithPhoto.photoUrl) {
              // Check if it's a Telegram CDN URL (old format) and fall back to default
              if (messageWithPhoto.photoUrl.startsWith('https://api.telegram.org/file/bot')) {
                console.warn('Found old Telegram CDN URL in database, using default image');
                photoUrl = './src/assets/0056.jpg';
              } else {
                // Check if the local file exists
                try {
                  const fs = require('fs');
                  if (fs.existsSync(messageWithPhoto.photoUrl)) {
                    photoUrl = messageWithPhoto.photoUrl;
                  } else {
                    console.warn(`Photo file not found: ${messageWithPhoto.photoUrl}, using default`);
                    photoUrl = './src/assets/0056.jpg';
                  }
                } catch (fileError) {
                  console.warn(`Error checking photo file: ${fileError}, using default`);
                  photoUrl = './src/assets/0056.jpg';
                }
              }
            }
          }
        } catch (error) {
          console.warn('Failed to retrieve photo from database, using default:', error);
        }
        
        const adminMenu = MenuFactory.createWorkerMenu(
          request as unknown as FullRequestType,
          photoUrl,
          undefined,
          isWorkGroup,
          isHubGroup,
        );
        await this.bot.telegram.editMessageCaption(
          Number(message.chatId),
          Number(message.messageId),
          undefined,
          adminMenu.inWork().caption,
          {
            parse_mode: 'HTML',
            reply_markup: adminMenu.inWork(undefined, requestId).markup,
          },
        );
      }
      this.logger.log(
        `Admin message for request ${request.id} updated successfully`,
      );
    } catch (error) {
      this.logger.error(`Error updating worker messages: ${error.message}`);
    }
  }
  async updateAdminMessages(requestId: string) {
    try {
      const request = await this.requestService.findById(requestId);
      if (!request) throw new Error('Request not found');
      const messages = request.message.filter((m) => m.accessType === 'ADMIN');
      if (messages.length === 0) return;
      // Try to get photo URL from database
      let photoUrl = './src/assets/0056.jpg'; // default fallback
      try {
        const dbMessages = await this.requestService.getAllPublicMessagesWithRequestsId(requestId);
        if (dbMessages && dbMessages.length > 0) {
          const messageWithPhoto = dbMessages.find(msg => msg.photoUrl && msg.photoUrl !== '');
          if (messageWithPhoto && messageWithPhoto.photoUrl) {
            // Check if it's a Telegram CDN URL (old format) and fall back to default
            if (messageWithPhoto.photoUrl.startsWith('https://api.telegram.org/file/bot')) {
              console.warn('Found old Telegram CDN URL in database, using default image');
              photoUrl = './src/assets/0056.jpg';
            } else {
              // Check if the local file exists
              try {
                const fs = require('fs');
                if (fs.existsSync(messageWithPhoto.photoUrl)) {
                  photoUrl = messageWithPhoto.photoUrl;
                } else {
                  console.warn(`Photo file not found: ${messageWithPhoto.photoUrl}, using default`);
                  photoUrl = './src/assets/0056.jpg';
                }
              } catch (fileError) {
                console.warn(`Error checking photo file: ${fileError}, using default`);
                photoUrl = './src/assets/0056.jpg';
              }
            }
          }
        }
      } catch (error) {
        console.warn('Failed to retrieve photo from database, using default:', error);
      }
      
      const requests = messages.map((m) => {
        const adminMenu = MenuFactory.createAdminMenu(
          request as unknown as FullRequestType,
          photoUrl,
        );
        return this.bot.telegram.editMessageCaption(
          Number(m.chatId),
          Number(m.messageId),
          undefined,
          adminMenu.inWork(undefined, m.requestId).caption,
          {
            parse_mode: 'HTML',
            reply_markup: adminMenu.inWork(undefined, requestId).markup,
          },
        );
      });
      await Promise.all(requests);
      this.logger.log(
        `Admin message for request ${request.id} updated successfully`,
      );
    } catch (err) {
      console.error(err);
      throw new Error('Failed to send request to work group');
    }
  }
  async notificateToWorkGroup(requests: FullRequestType[]) {
    try {
      const chatId = this.configService.get<number>('WORK_GROUP_CHAT');

      if (!chatId) {
        throw new Error('Work group chat not found');
      }
      const NOTIFICATION_DELAY_MS = 15 * 60 * 1000;
      const now = Date.now();
      const filteredRequeste = requests.filter(
        (r) =>
          r.status === 'PENDING' &&
          now - new Date(r.createdAt).getTime() >= NOTIFICATION_DELAY_MS,
      );
      for (const request of filteredRequeste) {
        const previousReminders = await this.requestService.findReminderMessages(request.id);
        if (previousReminders.length > 0) {
          await this.deleteAllTelegramMessages(
            previousReminders.map((r) => Number(r.messageId)),
            chatId,
          );
          await this.requestService.deleteReminderMessages(request.id);
        }

        const workerMessage = request.message?.find(
          (m) => m.accessType === 'WORKER' && m.messageId,
        );
        if (!workerMessage?.messageId) continue;

        try {
          const sent = await this.sendMessageWithRetry(
            () => this.bot.telegram.sendMessage(
              chatId,
              `Обратите внимание на заявку #${request.id}`,
              {
                reply_parameters: {
                  message_id: Number(workerMessage.messageId),
                },
              },
            )
          );
          if (sent && (sent as { message_id?: number }).message_id) {
            await this.requestService.saveReminderMessage(
              request.id,
              chatId,
              (sent as { message_id: number }).message_id,
            );
          }
        } catch (err) {
          this.logger.error(`Failed to send reminder for request ${request.id}`, err);
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      // It's a good practice to log the error for debugging
      console.error('Error sending message to work group:', error);
    }
  }
  async deleteReminderMessagesForRequest(requestId: string) {
    try {
      const reminders =
        await this.requestService.findReminderMessages(requestId);
      if (reminders.length === 0) return;
      const chatId =
        Number(reminders[0].chatId) ||
        this.configService.get<number>('WORK_GROUP_CHAT');
      await this.deleteAllTelegramMessages(
        reminders.map((r) => Number(r.messageId)),
        chatId,
      );
      await this.requestService.deleteReminderMessages(requestId);
    } catch (err) {
      this.logger.error(
        `Failed to delete reminder messages for request ${requestId}`,
        err,
      );
    }
  }

  async sendRequestToWorkGroup(request: FullRequestType) {
    try {
      const chatId = this.configService.get<number>('WORK_GROUP_CHAT');
      if (!chatId) {
        throw new Error('Work group chat not found');
      }
      
      // Try to get photo URL from database
      let photoUrl = './src/assets/0056.jpg'; // default fallback
      try {
        const messages = await this.requestService.getAllPublicMessagesWithRequestsId(request.id);
        if (messages && messages.length > 0) {
          const messageWithPhoto = messages.find(msg => msg.photoUrl && msg.photoUrl !== '');
          if (messageWithPhoto && messageWithPhoto.photoUrl) {
            photoUrl = messageWithPhoto.photoUrl;
          }
        }
      } catch (error) {
        console.warn('Failed to retrieve photo from database, using default:', error);
      }
      
      let handled = false;
      if (request.currency?.name === CurrencyEnum.USD && request.methods?.length) {
        for (const method of request.methods) {
          const payload = RequestMessageFactory.create('WORKER', request, method);
          if (!payload) {
            continue;
          }
          await this.sendWorkerPhotoMessage(chatId, request.id, payload);
          handled = true;
        }
      }

      if (!handled) {
        const workerMenu = MenuFactory.createWorkerMenu(
          request,
          photoUrl,
          undefined,
          false,
          true,
        );
        const payload: ReplyPhotoMessage = {
          text: workerMenu.inWork().caption,
          inline_keyboard: workerMenu.inWork(undefined, request.id).markup,
          source: workerMenu.inWork().source,
          photoUrl: workerMenu.inWork().url,
        };
        await this.sendWorkerPhotoMessage(chatId, request.id, payload);
      }
    } catch (err) {
      console.error(err);
      throw new Error('Failed to send request to work group');
    }
  }

  private async sendWorkerPhotoMessage(
    chatId: number,
    requestId: string,
    payload: ReplyPhotoMessage,
  ) {
    const photoPath = payload.photoUrl ?? photoUrl;
    
    const photoSource = payload.source
      ? { source: payload.source }
      : photoInput(photoPath);

    const message = await this.bot.telegram.sendPhoto(chatId, photoSource, {
      parse_mode: 'HTML',
      reply_markup: payload.inline_keyboard ?? undefined,
      caption: payload.text ?? '',
    });

    await this.userService.saveMessage({
      accessType: 'WORKER',
      chatId: BigInt(chatId),
      messageId: message.message_id,
      photoUrl: photoPath,
      text: payload.text ?? '',
      requestId,
    });
  }
  async sendMessageToUser(
    message: ReplyPhotoMessage,
    chatId: number,
    requestId: string,
    userId?: string,
  ) {
    try {
      const inline_keyboard = message.inline_keyboard;
      const photoPath = message.photoUrl ? message.photoUrl : DEFAULT_PHOTO;
      const photoSource = photoInput(photoPath);

      const photoMsg = await this.bot.telegram.sendPhoto(
        chatId,
        photoSource,
        {
          parse_mode: 'HTML',
          reply_markup: inline_keyboard,
          caption: message.text || '',
        },
      );
      const messageToSave: SerializedMessage = {
        chatId: BigInt(chatId),
        photoUrl: message.photoUrl ? message.photoUrl : '',
        messageId: photoMsg.message_id,
        text: message.text || '',
        requestId: requestId,
        accessType: 'WORKER',
      };
      if (photoMsg) {
        await this.userService.saveWorkerRequestPhotoMessage(
          messageToSave,
          requestId,
          userId ? userId : '',
        );
      }
      return photoMsg;
    } catch (error) {
      this.logger.error('Error sending message to user', error);
      throw error;
    }
  }

  async updateAllPublicMessagesWithRequestsId(
    newMessage: ReplyPhotoMessage,
    requestId?: string,
  ) {
    try {
      if (!requestId) {
        this.logger.warn('No request ID provided for updating public messages');
        return;
      }
      const messages =
        await this.requestService.getAllPublicMessagesWithRequestsId(requestId);
      if (!messages || messages.length === 0) {
        this.logger.warn('No public messages found for the given request ID');
        return;
      }
      for (const message of messages) {
        const chatId = Number(message.chatId);
        const messageId = Number(message.messageId);
        const newCaption = newMessage.text ? newMessage.text : message.text;
        if (chatId && messageId) {
          if (!message.photoUrl || message.photoUrl.length === 0) {
            await this.bot.telegram.editMessageText(
              chatId,
              messageId,
              undefined,
              newCaption || '',
              {
                parse_mode: 'HTML',
                reply_markup: newMessage.inline_keyboard,
              },
            );
            continue;
          }

          if (newMessage.source) {
            if (!message.paymentRequests?.vendor.showReceipt) {
              await this.bot.telegram.editMessageMedia(
                chatId,
                messageId,
                undefined,
                {
                  parse_mode: 'HTML',
                  caption: newCaption || '',
                  type: 'photo',
                  media: photoInput(DEFAULT_PHOTO),
                },
                { reply_markup: newMessage.inline_keyboard },
              );
            } else {
              await this.bot.telegram.editMessageMedia(
                chatId,
                messageId,
                undefined,
                {
                  parse_mode: 'HTML',
                  caption: newCaption || '',
                  type: 'photo',
                  media: { source: newMessage.source },
                },
                { reply_markup: newMessage.inline_keyboard },
              );
            }
          } else {
            await this.bot.telegram.editMessageCaption(
              chatId,
              messageId,
              undefined,
              newCaption || '',
              { reply_markup: newMessage.inline_keyboard, parse_mode: 'HTML' },
            );
          }
        }
        await new Promise((res) => setTimeout(res, 300));
      }
    } catch (error) {
      this.logger.error('Error updating public messages', error);
    }
  }
  async sendPhotoMessageToAllWorkers(
    message: ReplyPhotoMessage,
    requestId?: string,
  ) {
    try {
      const workers = await this.userService.getAllActiveWorkers();
      const inline_keyboard = message.inline_keyboard;

      if (!workers || workers.length === 0) {
        this.logger.warn('No active workers found');
        return [];
      }

      const processedRequestsId: {
        requestId: string;
        username: string;
        proceeded: boolean;
      }[] = [];

      if (!requestId) {
        processedRequestsId.push({
          requestId: 'No Request ID',
          username: 'No Request ID provided',
          proceeded: false,
        });
        return processedRequestsId;
      }

      let foundWorker: (typeof workers)[0] | null = null;
      let attempts = 0;

      while (!foundWorker && attempts < workers.length) {
        this.lastWorkerIndex = (this.lastWorkerIndex + 1) % workers.length;
        const currentWorker = workers[this.lastWorkerIndex];

        const notDoneActiveRequests = currentWorker.paymentRequests.filter(
          (request) =>
            request.status !== 'COMPLETED' && request.status !== 'FAILED',
        );

        if (notDoneActiveRequests.length <= 1) {
          foundWorker = currentWorker;
        }

        attempts++;
      }

      if (foundWorker) {
        if (foundWorker.telegramId) {
          const chatId = Number(foundWorker.telegramId);

          // Check if chat exists before attempting to send message
          const chatExists = await this.checkChatExists(chatId);
          if (!chatExists) {
            this.logger.warn(
              `Skipping worker ${foundWorker.username} (${chatId}) - chat not found`,
            );
            processedRequestsId.push({
              requestId: requestId,
              username: foundWorker.username || 'Unknown',
              proceeded: false,
            });
            return processedRequestsId;
          }

          await this.userService.appendRequestToUser(foundWorker.id, requestId);

          try {
            const photoPath = message.photoUrl ? message.photoUrl : DEFAULT_PHOTO;
            const photoSource = photoInput(photoPath);
              
            const photoMsg = await this.bot.telegram.sendPhoto(
              chatId,
              photoSource,
              {
                reply_markup: inline_keyboard,
                caption: message.text || '',
                parse_mode: 'HTML',
              },
            );
            const messageToSave: SerializedMessage = {
              chatId: BigInt(chatId),
              photoUrl: message.photoUrl ? message.photoUrl : '',
              messageId: photoMsg.message_id,
              text: message.text || '',
              requestId: requestId,
              accessType: 'WORKER',
            };
            processedRequestsId.push({
              requestId: requestId,
              username: foundWorker.username ? foundWorker.username : 'Unknown',
              proceeded: true,
            });
            if (photoMsg) {
              await this.userService.saveWorkerRequestPhotoMessage(
                messageToSave,
                requestId,
                foundWorker.id,
              );
            }
          } catch (sendError) {
            this.logger.error(
              `Failed to send photo to worker ${foundWorker.username} (${chatId}):`,
              sendError,
            );
            processedRequestsId.push({
              requestId: requestId,
              username: foundWorker.username || 'Unknown',
              proceeded: false,
            });
          }
        }
      } else {
        processedRequestsId.push({
          requestId: requestId,
          username: 'All Workers busy',
          proceeded: false,
        });
      }
      return processedRequestsId;
    } catch (e) {
      this.logger.error('Error in sendPhotoMessageToAllWorkers', e);
      throw e;
    }
  }
  async sendPhotoMessageToAllAdmins(
    message: ReplyPhotoMessage,
    requestId?: string,
  ) {
    try {
      const admins = await this.userService.getAllActiveAdmins();
      console.log('Admins:', admins);
      if (!admins || admins.length === 0) {
        this.logger.warn('No active admins found');
        return;
      }
      const processedAdmins = new Set<string>();
      for (const admin of admins) {
        if (admin.telegramId) {
          const chatId = Number(admin.telegramId);

          // Check if chat exists before attempting to send message
          const chatExists = await this.checkChatExists(chatId);
          if (!chatExists) {
            this.logger.warn(
              `Skipping admin ${admin.username} (${chatId}) - chat not found`,
            );
            continue;
          }

          this.logger.log(
            `Sending message to admin ${admin.username} (${chatId})`,
          );
          if (requestId) {
            try {
              const photoPath = message.photoUrl ?? DEFAULT_PHOTO;

              const photoSource = message.source
                ? { source: message.source }
                : photoInput(photoPath);
              
              const photoMsg = await this.bot.telegram.sendPhoto(
                chatId,
                photoSource,
                {
                  parse_mode: 'HTML',
                  caption: message.text ?? '',
                  reply_markup: message.inline_keyboard ?? undefined,
                },
              );
              const messageToSave: SerializedMessage = {
                chatId: BigInt(chatId),
                photoUrl: photoPath,
                messageId: photoMsg.message_id,
                text: message.text || '',
                requestId: requestId,
                accessType: 'ADMIN',
              };
              if (photoMsg.message_id) {
                await this.userService.saveRequestPhotoMessage(
                  messageToSave,
                  requestId,
                  admin.id,
                );
                processedAdmins.add(admin.id);
              }
            } catch (sendError) {
              this.logger.error(
                `Failed to send photo to admin ${admin.username} (${chatId}):`,
                sendError,
              );
              continue;
            }
          }
        }
      }
      return processedAdmins;
    } catch (error) {
      this.logger.error('Error sending message to admins', error);
    }
  }
  async updateAllWorkersMessagesWithRequestsId(
    newMessage: ReplyPhotoMessage,
    requestId?: string,
    excludeMessageIds?: number[],
  ) {
    try {
      if (!requestId) {
        this.logger.warn('No request ID provided for updating admin messages');
        return;
      }
      const messages =
        await this.userService.getAlWorkerMessagesWithRequestsId(requestId);
      if (!messages || messages.length === 0) {
        this.logger.warn('No active admins found');
        return;
      }
      for (const message of messages) {
        if (
          excludeMessageIds &&
          excludeMessageIds.includes(Number(message.messageId))
        ) {
          continue;
        }
        const chatId = Number(message.chatId);
        const messageId = Number(message.messageId);
        const newCaption = newMessage.text ? newMessage.text : message.text;

        if (chatId && messageId) {
          if (newMessage.source) {
            await this.bot.telegram.editMessageMedia(
              chatId,
              messageId,
              undefined,
              {
                parse_mode: 'HTML',
                caption: newCaption || '',
                type: 'photo',
                media: { source: newMessage.source },
              },
              { reply_markup: newMessage.inline_keyboard },
            );
          } else {
            await this.bot.telegram.editMessageCaption(
              chatId,
              messageId,
              undefined,
              newCaption || '',
              { reply_markup: newMessage.inline_keyboard, parse_mode: 'HTML' },
            );
          }
        }
      }
    } catch (error) {
      this.logger.error('Error updating admin messages', error);
    }
  }
  async updateAllAdminsMessagesWithRequestsId(
    newMessage: ReplyPhotoMessage,
    requestId?: string,
  ) {
    try {
      if (!requestId) {
        this.logger.warn('No request ID provided for updating admin messages');
        return;
      }
      const messages =
        await this.userService.getAllAdminsMessagesWithRequestsId(requestId);
      if (!messages || messages.length === 0) {
        this.logger.warn('No active admins found');
        return;
      }
      for (const message of messages) {
        await this.updateAdminMessage(
          Number(message.chatId),
          Number(message.messageId),
          newMessage.text,
          newMessage.photoUrl ? newMessage.photoUrl : undefined,
          newMessage.source,
          newMessage.inline_keyboard,
        );
      }
    } catch (error) {
      this.logger.error('Error updating admin messages', error);
    }
  }
  async updateAdminMessage(
    chatId: number,
    messageId: number,
    text: string,
    imageUrl?: string,
    source?: Buffer<ArrayBufferLike>,
    markup?: InlineKeyboardMarkup,
  ) {
    try {
      if (imageUrl) {
        await this.updateTelegramMessage(
          chatId,
          messageId,
          text,
          imageUrl,
          source,
          markup,
        );
      } else if (source) {
        await this.updateTelegramMessage(
          chatId,
          messageId,
          text,
          undefined,
          source,
          markup,
        );
      } else {
        await this.bot.telegram.editMessageCaption(
          chatId,
          messageId,
          undefined,
          text ? text : '',
          { reply_markup: markup ?? undefined, parse_mode: 'HTML' },
        );
      }
    } catch (error) {
      this.logger.error('Error updating admin message', error);
    }
  }

  async updateTelegramMessage(
    chatId: number,
    messageId: number,
    text?: string,
    imageUrl?: string,
    source?: Buffer<ArrayBufferLike>,
    markup?: InlineKeyboardMarkup,
  ) {
    try {
      if (imageUrl) {
        await this.bot.telegram.editMessageMedia(
          chatId,
          messageId,
          undefined,
          {
            parse_mode: 'HTML',
            type: 'photo',
            media: imageUrl,
            caption: text,
          },
          { reply_markup: markup ?? undefined },
        );
      } else if (source) {
        await this.bot.telegram.editMessageMedia(
          chatId,
          messageId,
          undefined,
          {
            parse_mode: 'HTML',
            type: 'photo',
            media: { source: source },
            caption: text,
          },
          { reply_markup: markup ?? undefined },
        );
      } else {
        await this.bot.telegram.editMessageText(
          chatId,
          messageId,
          undefined,
          text ? text : 'asdasdasd',
          { reply_markup: markup ?? undefined, parse_mode: 'HTML' },
        );
      }
    } catch (error) {
      this.logger.error('Error updating message', error);
    }
  }

  async sendDocumentToAllUsers(
    source: Buffer<ArrayBufferLike>,
    fileName: string,
    caption?: string,
  ) {
    try {
      const users = await this.userService.getAllUsers();
      if (!users || users.length === 0) {
        this.logger.warn('No active admins found');
        return;
      }
      for (const user of users) {
        if (user.telegramId) {
          const chatId = Number(user.telegramId);
          await this.bot.telegram.sendDocument(
            chatId,
            {
              source: source,
              filename: fileName,
            },
            { parse_mode: 'HTML', caption: caption || '' },
          );
        }
      }
    } catch (error) {
      this.logger.error('Error sending document to users', error);
    }
  }
  async deleteAllTelegramMessages(
    messageIds: number[] | undefined,
    chatId: number | undefined,
    msgIdToPass?: number[],
  ) {
    try {
      if (!messageIds || messageIds.length === 0) {
        this.logger.warn('No message IDs provided for deletion');
        return;
      }
      if (!chatId) {
        return this.logger.warn('No chat ID provided for deletion');
      }
      for (const messageId of messageIds) {
        if (msgIdToPass?.includes(messageId)) {
          continue;
        }
        try {
          await this.bot.telegram.deleteMessage(chatId, messageId);
          this.logger.log(`Successfully deleted message ${messageId} from chat ${chatId}`);
        } catch (deleteError: any) {
          // Handle specific error cases
          if (deleteError.response?.error_code === 400) {
            const errorDescription = deleteError.response?.description || '';
            if (errorDescription.includes('message to delete not found')) {
              this.logger.warn(`Message ${messageId} not found in chat ${chatId} - may have been deleted already or doesn't exist`);
            } else if (errorDescription.includes('message can\'t be deleted')) {
              this.logger.warn(`Message ${messageId} cannot be deleted from chat ${chatId} - ${errorDescription}`);
            } else {
              this.logger.warn(`Failed to delete message ${messageId} from chat ${chatId}: ${errorDescription}`);
            }
            continue;
          }
          // Re-throw other errors
          throw deleteError;
        }
      }
    } catch (error) {
      this.logger.error('Error deleting messages', error);
    }
  }

  // Новый метод для отправки сообщения только одному работнику
  async sendPhotoMessageToWorker(
    message: ReplyPhotoMessage,
    requestId: string,
    worker: { id: string; telegramId: string; username?: string },
  ) {
    try {
      if (!worker || !worker.telegramId) return;

      const chatId = Number(worker.telegramId);

      // Check if chat exists before attempting to send message
      const chatExists = await this.checkChatExists(chatId);
      if (!chatExists) {
        this.logger.warn(
          `Skipping worker ${worker.username} (${chatId}) - chat not found`,
        );
        return;
      }

      await this.userService.appendRequestToUser(worker.id, requestId);
      const photoPath = message.photoUrl ? message.photoUrl : DEFAULT_PHOTO;
      const photoSource = photoInput(photoPath);
        
      const photoMsg = await this.bot.telegram.sendPhoto(
        chatId,
        photoSource,
        {
          parse_mode: 'HTML',
          reply_markup: message.inline_keyboard,
          caption: message.text || '',
        },
      );
      const messageToSave: SerializedMessage = {
        chatId: BigInt(chatId),
        photoUrl: message.photoUrl ? message.photoUrl : '',
        messageId: photoMsg.message_id,
        text: message.text || '',
        requestId: requestId,
        accessType: 'WORKER',
      };
      if (photoMsg) {
        await this.userService.saveWorkerRequestPhotoMessage(
          messageToSave,
          requestId,
          worker.id,
        );
      }
    } catch (e) {
      this.logger.error('Error in sendPhotoMessageToWorker', e);
      throw e;
    }
  }

  private async sendMessageWithRetry<T>(
    sendFunction: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await sendFunction();
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a rate limit error (429)
        if (error.response?.error_code === 429) {
          const retryAfter = error.response.parameters?.retry_after || (attempt + 1) * 2;
          const delay = retryAfter * 1000; // Convert to milliseconds
          
          console.log(`[TelegramService] Rate limited, retrying after ${retryAfter}s (attempt ${attempt + 1}/${maxRetries + 1})`);
          
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        // For non-rate-limit errors or if we've exhausted retries, throw immediately
        throw error;
      }
    }
    
    throw lastError;
  }
}
