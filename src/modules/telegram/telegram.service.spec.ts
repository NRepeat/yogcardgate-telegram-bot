import { Test, TestingModule } from '@nestjs/testing';
import { TelegramService } from './telegram.service';
import { UserService } from '../user/user.service';
import { RequestService } from '../request/request.service';
import { ConfigService } from '@nestjs/config';

describe('TelegramService', () => {
  let service: TelegramService;
  let mockBot: any;
  let mockUserService: Partial<UserService>;
  let mockRequestService: Partial<RequestService>;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(async () => {
    // Mock the telegram bot
    mockBot = {
      telegram: {
        getChat: jest.fn(),
        sendMessage: jest.fn(),
        sendPhoto: jest.fn(),
      },
    };

    mockUserService = {};
    mockRequestService = {};
    mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramService,
        {
          provide: 'TELEGRAF_MODULE_BOT',
          useValue: mockBot,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: RequestService,
          useValue: mockRequestService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<TelegramService>(TelegramService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkChatExists', () => {
    it('should return true when chat exists', async () => {
      const chatId = 12345;
      mockBot.telegram.getChat.mockResolvedValue({ id: chatId });

      const result = await service.checkChatExists(chatId);

      expect(result).toBe(true);
      expect(mockBot.telegram.getChat).toHaveBeenCalledWith(chatId);
    });

    it('should return false when chat does not exist', async () => {
      const chatId = 12345;
      mockBot.telegram.getChat.mockRejectedValue(new Error('Chat not found'));

      const result = await service.checkChatExists(chatId);

      expect(result).toBe(false);
      expect(mockBot.telegram.getChat).toHaveBeenCalledWith(chatId);
    });
  });

  describe('notificateToWorkGroup', () => {
    it('should not send messages when work group chat does not exist', async () => {
      const workGroupChatId = 54321;
      const mockRequests = [
        {
          id: 'req1',
          status: 'PENDING',
          message: [{ accessType: 'WORKER' }],
        },
      ];

      mockConfigService.get = jest.fn().mockReturnValue(workGroupChatId);
      mockBot.telegram.getChat.mockRejectedValue(new Error('Chat not found'));

      await service.notificateToWorkGroup(mockRequests as any);

      expect(mockBot.telegram.getChat).toHaveBeenCalledWith(workGroupChatId);
      expect(mockBot.telegram.sendMessage).not.toHaveBeenCalled();
    });

    it('should send messages when work group chat exists', async () => {
      const workGroupChatId = 54321;
      const mockRequests = [
        {
          id: 'req1',
          status: 'PENDING',
          message: [{ accessType: 'WORKER' }],
        },
      ];

      mockConfigService.get = jest.fn().mockReturnValue(workGroupChatId);
      mockBot.telegram.getChat.mockResolvedValue({ id: workGroupChatId });
      mockBot.telegram.sendMessage.mockResolvedValue({ message_id: 123 });

      await service.notificateToWorkGroup(mockRequests as any);

      expect(mockBot.telegram.getChat).toHaveBeenCalledWith(workGroupChatId);
      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
        workGroupChatId,
        expect.stringContaining('⚠️ Обратите внимание на заявку #req1'),
        expect.objectContaining({
          parse_mode: 'HTML',
        }),
      );
    });

    it('should handle missing work group chat ID', async () => {
      mockConfigService.get = jest.fn().mockReturnValue(undefined);

      await service.notificateToWorkGroup([]);

      expect(mockBot.telegram.getChat).not.toHaveBeenCalled();
      expect(mockBot.telegram.sendMessage).not.toHaveBeenCalled();
    });
  });
});