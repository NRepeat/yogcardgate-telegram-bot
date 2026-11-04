import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectBot } from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';
import PaymentWizard from './paymnet/paymnet.scene';
import { findStuckCheckingSessions } from 'src/session.store';

export const STUCK_AFTER_MS = 3 * 60_000;

/** Frees close wizards stuck in 'checking' (e.g. a crash mid-check) and tells the admin chat. */
@Injectable()
export class CloseWatchdogService {
  constructor(
    @InjectBot() private readonly bot: Telegraf<Context>,
    private readonly configService: ConfigService,
    private readonly paymentWizard: PaymentWizard,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sweep() {
    for (const foreign of findStuckCheckingSessions(STUCK_AFTER_MS)) {
      const chatId = Number(foreign.key.split(':')[0]);
      try {
        await this.paymentWizard.recoverStuck(chatId, foreign);
        const admin = this.configService.get<string>('TELEGRAM_CHAT_ID');
        if (admin) {
          await this.bot.telegram.sendMessage(
            admin,
            `⚠️ Закрытие заявки ${foreign.state.requestId} зависло на сверке, оператор ${foreign.operatorTgId} возвращён на ввод ордера.`,
          );
        }
      } catch (error) {
        console.error('Close watchdog failed:', error);
      }
    }
  }
}
