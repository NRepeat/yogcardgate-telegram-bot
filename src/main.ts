import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';
import { getBotToken } from 'nestjs-telegraf';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  const bot = app.get<Telegraf>(getBotToken());
  app.use(bot.webhookCallback('/telegram/webhook'));

  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.enableCors();

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
