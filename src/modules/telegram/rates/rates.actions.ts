import { Ctx, Command, Hears, Update } from 'nestjs-telegraf';
import { RatesService } from 'src/modules/rates/rates.service';
import { UserService } from 'src/modules/user/user.service';
import { SceneContext } from 'telegraf/typings/scenes';
@Update()
export class RatesActions {
  constructor(
    private readonly ratesService: RatesService,
    private readonly userService: UserService,
  ) {}

  @Hears('Обновить курсы')
  async onRates(@Ctx() ctx: SceneContext) {
    const msId = ctx.message?.message_id;
    await ctx.deleteMessage(msId);
    const isAdmin = await this.userService.isAdminChat(ctx);
    if (!isAdmin) {
      //
      return;
    }
    await ctx.scene.enter('create-rates');
  }

  @Command('rateup')
  async onRateUp(@Ctx() ctx: SceneContext) {
    const msId = ctx.message?.message_id;
    await ctx.deleteMessage(msId);
    const isAdmin = await this.userService.isAdminChat(ctx);
    if (!isAdmin) {
      return;
    }
    await ctx.scene.enter('create-rates');
  }
}
