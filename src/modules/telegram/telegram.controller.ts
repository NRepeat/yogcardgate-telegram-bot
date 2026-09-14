import { Ctx, InjectBot, On, Start, Update } from 'nestjs-telegraf';
import { Context, Markup, Telegraf } from 'telegraf';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import PaymentWizard, {
  isBookkeeperId,
  parseCloseNum,
} from './paymnet/paymnet.scene';
import { CustomSceneContext } from 'src/types/types';
import { findForeignCloseSession } from 'src/session.store';

/** Шаги закрытия, куда можно вписать курс: 'checking' — сверка, туда нельзя. */
const OPEN_CLOSE_STAGES = ['rate', 'order'];

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
    await this.bookkeeperRate(ctx as CustomSceneContext);
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

    const foreign = findForeignCloseSession(chatId, fromId, OPEN_CLOSE_STAGES);
    if (!foreign) return;

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
