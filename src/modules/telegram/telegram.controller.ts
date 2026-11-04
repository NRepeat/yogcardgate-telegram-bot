import { Ctx, InjectBot, On, Start, Update } from 'nestjs-telegraf';
import { Context, Markup, Telegraf } from 'telegraf';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import PaymentWizard, {
  isBookkeeperId,
  parseCloseNum,
} from './paymnet/paymnet.scene';
import { CustomSceneContext } from 'src/types/types';
import { findForeignCloseSession, findSessionByKey } from 'src/session.store';

/**
 * Шаги закрытия, куда бухгалтер может вписать текст: 'partner' — имя партнёра,
 * 'rate'/'order' — курс. 'checking' — сверка, туда нельзя.
 */
const OPEN_CLOSE_STAGES = ['partner', 'rate', 'order'];

@Update()
export class TelegramController {
  constructor(
    @InjectBot() private readonly bot: Telegraf<Context>,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
    private readonly paymentWizard: PaymentWizard,
  ) {}
  @On('message')
  async on(@Ctx() ctx: Context) {
    if (await this.staffReset(ctx as CustomSceneContext)) return;
    await this.bookkeeperRate(ctx as CustomSceneContext);
  }

  /**
   * `/reset` as a reply to an operator's message (bookkeeper/owner only): wipes that
   * operator's wizard in this chat and gives the request card its buttons back.
   */
  private async staffReset(ctx: CustomSceneContext): Promise<boolean> {
    const msg = ctx.message as
      | { text?: string; reply_to_message?: { from?: { id: number } } }
      | undefined;
    if (!msg?.text || !/^\/reset(@\w+)?$/i.test(msg.text.trim())) return false;
    const chatId = ctx.chat?.id;
    const fromId = ctx.from?.id;
    const targetId = msg.reply_to_message?.from?.id;
    const staff = [
      this.configService.get<string>('BOOKKEEPER_TG_IDS'),
      this.configService.get<string>('OWNER_TG_IDS'),
    ].some((csv) => isBookkeeperId(fromId, csv));
    if (!staff || !chatId || !targetId) return false;
    const foreign = findSessionByKey(`${chatId}:${targetId}`);
    if (!foreign) {
      await ctx.reply('Нет открытого шага у этого оператора.');
      return true;
    }
    try {
      await this.paymentWizard.resetForeign(chatId, foreign);
      await ctx.reply('✅ Сессия оператора сброшена.');
    } catch (error) {
      console.error('staff reset failed:', error);
      await ctx.reply('⚠️ Не удалось сбросить сессию.');
    }
    return true;
  }

  /**
   * Курс бухгалтера в чужой визард. Сессии разложены по `chat:user`, поэтому
   * сообщение бухгалтера до шага оператора само не доходит: находим открытый
   * шаг закрытия в этом же чате и закрываем заявку им. Как в gx, где
   * состояние визарда общее на чат.
   *
   * Молчим, если в чате закрывать нечего: числа в рабочих группах пишут и
   * просто так, отвечать на каждое — спам.
   */
  private async bookkeeperRate(ctx: CustomSceneContext) {
    const text = (ctx.message as { text?: string } | undefined)?.text?.trim();
    const chatId = ctx.chat?.id;
    const fromId = ctx.from?.id;
    if (!text || !chatId || !fromId) return;
    if (
      !isBookkeeperId(fromId, this.configService.get<string>('BOOKKEEPER_TG_IDS'))
    ) {
      return;
    }
    // Свой визард бухгалтера обрабатывает сцена — сюда такие апдейты не
    // доходят, но состояние проверяем: чужую заявку закрываем только когда
    // своей на руках нет.
    if ((ctx.session as any)?.__scenes?.state?.closeStage) return;

    // Закрывать нечего — молчим: «курс 41» в рабочем чате пишут и просто так,
    // предупреждение на каждое такое сообщение читается как поломка бота.
    const foreign = findForeignCloseSession(chatId, fromId, OPEN_CLOSE_STAGES);
    if (!foreign) return;

    // Имя партнёра — не курс: просто записываем и двигаем шаг к курсу.
    if (foreign.state.closeStage === 'partner') {
      await this.paymentWizard.setForeignPartner(ctx, foreign, text);
      return;
    }

    // «курс 41.25» — явная форма; голое число — тоже курс, но на шаге ордера
    // длинное число это ID ордера, а не курс.
    const manual = /^курс\s+(.+)$/iu.exec(text);
    const raw = manual
      ? manual[1]
      : foreign.state.closeStage === 'order' && /^\d{5,}$/.test(text)
        ? null
        : text;
    const rate = raw ? parseCloseNum(raw) : null;
    if (!rate) return;

    try {
      const closed = await this.paymentWizard.closeForeignWithRate(
        ctx,
        foreign,
        rate,
      );
      if (closed) {
        await ctx.reply(`✅ Курс ${rate} принят, заявка закрыта.`);
      }
    } catch (error) {
      console.error('bookkeeper rate failed:', error);
      await ctx.reply('⚠️ Не удалось закрыть заявку этим курсом.');
    }
  }
}
