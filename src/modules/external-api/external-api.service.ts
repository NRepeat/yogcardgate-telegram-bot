import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ExternalApiService {
  private readonly logger = new Logger(ExternalApiService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('EXTERNAL_API_URL') || '';
    this.apiKey = this.configService.get<string>('EXTERNAL_API_KEY') || '';
  }

  async notifyRateUpdate(type: string, rateValue: number) {
    if (!this.apiUrl || !this.apiKey) {
      this.logger.warn('External API configuration missing (URL or Key)');
      return;
    }

    const url = `${this.apiUrl}/rates/update`;
    const body = {
      type: type.toLowerCase(),
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
        this.logger.log(`External API notified successfully: ${type} -> ${rateValue}`);
      } else {
        this.logger.error(`Failed to notify External API. Status: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      this.logger.error(`Error sending request to External API: ${error.message}`);
    }
  }
}
