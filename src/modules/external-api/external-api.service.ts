import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const GROUPS_MAP: Record<string, string> = {
  'IBAN_UAH': 'iban_uah',
  'CARD_UAH': 'card_uah',
  'CARD_USD': 'usdt_trc20_usd',
  'CARD_KZT': 'usdt_trc20_kzt',
  'CARD_EUR': 'usdt_trc20_eur',
  'CARD_AED': 'usdt_trc20_aed',
  'CARD_PLN': 'usdt_trc20_pln',
  'CNY_WECHAT_CNY': 'usdt_trc20_cny_wechat',
  'CNY_ALIPAY_CNY': 'usdt_trc20_cny_alipay',
  'CNY_CARD_CNY': 'usdt_trc20_cny_card',
  'CARD_AZN': 'usdt_trc20_azn',
  'CARD_TRY': 'usdt_trc20_try',
};

@Injectable()
export class ExternalApiService {
  private readonly logger = new Logger(ExternalApiService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('EXTERNAL_API_URL') || '';
    this.apiKey = this.configService.get<string>('EXTERNAL_API_KEY') || '';
  }

  async notifyRateUpdate(botType: string, rateValue: number) {
    if (!this.apiUrl || !this.apiKey) {
      this.logger.warn('External API configuration missing (URL or Key)');
      return;
    }

    const externalTypeId = GROUPS_MAP[botType.toUpperCase()];
    
    if (!externalTypeId) {
      this.logger.debug(`No mapping found for group: ${botType}, skipping external notification`);
      return;
    }

    const url = `${this.apiUrl}/rates/update`;
    const body = {
      type: externalTypeId,
      rate_from: 1,
      rate_to: rateValue,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        this.logger.log(`External API notified successfully: ${botType} (${externalTypeId}) -> ${rateValue}`);
      } else {
        this.logger.error(`Failed to notify External API for ${botType}. Status: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      this.logger.error(`Error sending request to External API for ${botType}: ${error.message}`);
    }
  }
}
