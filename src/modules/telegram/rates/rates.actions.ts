import { UseGuards } from '@nestjs/common';
import { Ctx, Command, Hears, Update } from 'nestjs-telegraf';
import { RatesService } from 'src/modules/rates/rates.service';
import { SceneContext } from 'telegraf/typings/scenes';
import { AdminGuard } from '../admin.guard';
@Update()
@UseGuards(AdminGuard)
export class RatesActions {
  constructor(private readonly ratesService: RatesService) {}

  @Hears('Обновить курсы')
  async onRates(@Ctx() ctx: SceneContext) {
    const msId = ctx.message?.message_id;
    await ctx.deleteMessage(msId);
    await ctx.scene.enter('create-rates');
  }

  @Command('rateup')
  async onRateUp(@Ctx() ctx: SceneContext) {
    const msId = ctx.message?.message_id;
    await ctx.deleteMessage(msId);
    await ctx.scene.enter('create-rates');
  }
}
