import { Injectable } from '@nestjs/common';
import { VendorService } from 'src/modules/vendor/vendor.service';
import { CustomSceneContext } from 'src/types/types';
import { Markup } from 'telegraf';
@Injectable()
export class VendorCallbackService {
  constructor(private readonly vendorService: VendorService) {}
  public async handleVendorAction(ctx: CustomSceneContext) {
    console.log('@Scene(user-vendor-wizard) callBack----');
    if (!('callbackQuery' in ctx) || !ctx.callbackQuery) return;
    const cbq = ctx.callbackQuery as { data?: string };
    const data = typeof cbq.data === 'string' ? cbq.data : '';
    console.log(data);
    
    let responseMessage = '';
    
    if (data.startsWith('provider_')) {
      const vendorId = data.replace('provider_', '');
      if (!vendorId) {
        responseMessage = 'Некорректный ID поставщика';
      } else {
        const vendor = await this.vendorService.getVendorById(vendorId);
        if (!vendor) {
          responseMessage = 'Поставщик не найден';
        } else {
          await this.vendorService.updateVendor({
            ...vendor,
            showReceipt: !vendor.showReceipt,
          });
          await this.sendVendorsList(ctx, true);
          responseMessage = 'Изменения сохранены';
        }
      }
    } else if (data.startsWith('toggle_off_')) {
      const vendorId = data.replace('toggle_off_', '');
      if (!vendorId) {
        responseMessage = 'Некорректный ID поставщика';
      } else {
        const vendor = await this.vendorService.getVendorById(vendorId);
        if (!vendor) {
          responseMessage = 'Поставщик не найден';
        } else {
          await this.vendorService.updateVendor({
            ...vendor,
            work: !vendor.work,
          });
          await this.sendVendorsList(ctx, true);
          responseMessage = 'Изменения сохранены';
        }
      }
    } else if (data === 'close') {
      await ctx.deleteMessage();
      return; // Don't answer callback query for close action
    } else {
      responseMessage = 'Неизвестная команда';
    }
    
    // Answer callback query only once with the appropriate message
    if (responseMessage) {
      await ctx.answerCbQuery(responseMessage);
    }
  }
  private async sendVendorsList(ctx: CustomSceneContext, edit = false) {
    const vendors = await this.vendorService.getAllVendors();
    const providersData = vendors.map((vendor) => ({
      id: vendor.id,
      name: vendor.title,
      checkOn: !!vendor.showReceipt,
      off: !!vendor.work,
    }));
    console.log(providersData);
    const inline_keyboard = providersData.map((provider) => {
      const checkOnIcon = provider.checkOn ? '✅' : '🚫';
      const offIcon = provider.off ? '▶️' : '⏸️';
      const buttonText = `${checkOnIcon} ${provider.name} `;
      return [
        Markup.button.callback(buttonText, `provider_${provider.id}`),
        Markup.button.callback(offIcon, `toggle_off_${provider.id}`),
      ];
    });
    inline_keyboard.push([Markup.button.callback('Закрыть', 'close')]);
    const messageText =
      '✅ - Показывать квитанции поставщику' +
      '\n🚫 - Не показывать квитанции поставщику' +
      '\n▶️ - Включить уведомления' +
      '\n⏸️ - Отключить уведомления' +
      '\nДля переключения режима нажмите на поставщика' +
      '\nСписок поставщиков:';
    if (edit) {
      await ctx.editMessageText(messageText, {
        reply_markup: { inline_keyboard },
        parse_mode: 'HTML',
      });
    } else {
      const msg = await ctx.reply(messageText, {
        reply_markup: { inline_keyboard },
        parse_mode: 'HTML',
      });
      ctx.session.messagesToDelete?.push(msg.message_id);
    }
  }
}
