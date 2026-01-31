import { promises as fs } from 'fs';
import * as path from 'path';
import { PaymentMethodEnum } from '@prisma/client';
import { FullRequestType, CustomSceneContext } from 'src/types/types';
import {
  CnyBaseStrategy,
  CnyStrategyDependencies,
  CreateRequestParams,
  ParsedStrategyInput,
  MissingAttachmentError,
} from './cny-base.strategy';
import { PhotoSize } from 'telegraf/typings/core/types/typegram';

interface CnyWechatParsedInput extends ParsedStrategyInput {
  identifier?: string;
  recipient?: string;
}

export class CnyWechatStrategy extends CnyBaseStrategy {
  constructor(deps: CnyStrategyDependencies) {
    super(deps);
  }

  protected supportsMethod(method: PaymentMethodEnum): boolean {
    return method === PaymentMethodEnum.CNY_WECHAT;
  }

  protected parseInput(message: string) {
    const lines = message
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return {
        success: false as const,
        error: 'Укажите сумму в подписи к фото.',
      };
    }

    const amount = this.tryParseAmount(lines[0]);
    if (!amount || amount <= 0) {
      return {
        success: false as const,
        error: 'Сумма должна быть положительным числом.',
      };
    }

    const identifier = lines[1] ?? undefined;
    const recipient = lines[2] ?? undefined;

    return {
      success: true as const,
      data: [{ amount, identifier, recipient }],
    };
  }

  protected async createRequest({
    ctx,
    currencyId,
    vendorId,
    rate,
    parsed,
  }: CreateRequestParams & { parsed: CnyWechatParsedInput }): Promise<FullRequestType> {
    const photo = this.extractPhotoOrThrow(ctx);
    const photoBuffer = await this.downloadPhotoBuffer(ctx, photo);
    const request = await this.deps.requestService.createGeneralRequest({
      amount: parsed.amount,
      vendorId,
      currencyId,
      rateId: rate.id,
      rate: String(rate.rate ?? ''),
      method: {
        method: PaymentMethodEnum.CNY_WECHAT,
        qr: {
          identifier: parsed.identifier || 'WeChat',
          comment: parsed.recipient ?? null,
        },
      },
    });

    const photoPath = await this.savePhotoForRequest(photoBuffer, request.id);
    await this.savePhotoToSceneState(photoPath, ctx);

    return request as unknown as FullRequestType;
  }

  protected buildDetails(data: CnyWechatParsedInput): string {
    const lines = [
      'Тип: CNY WeChat',
      `Сумма: ${data.amount} CNY`,
    ];
    if (data.identifier) {
      lines.push(`Идентификатор: ${data.identifier}`);
    }
    if (data.recipient) {
      lines.push(`Получатель: ${data.recipient}`);
    }
    return lines.join('\n');
  }

  private tryParseAmount(value: string): number | null {
    const normalized = value
      .replace(/[^0-9,\.]/g, '')
      .replace(/,/g, '.');
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private extractPhotoOrThrow(ctx: CustomSceneContext): PhotoSize {
    const state = ctx.scene.state as {
      cnyQrPayload?: { photo?: PhotoSize };
    };

    if (state.cnyQrPayload?.photo) {
      return state.cnyQrPayload.photo;
    }

    const message = ctx.message as { photo?: PhotoSize[] } | undefined;
    if (message && Array.isArray(message.photo) && message.photo.length > 0) {
      return message.photo[message.photo.length - 1];
    }

    throw new MissingAttachmentError(
      'Пожалуйста, отправьте фотографию WeChat.',
    );
  }

  private async savePhotoForRequest(buffer: Buffer, requestId: string): Promise<string> {
    const photoDir = path.join(process.cwd(), 'storage', 'request-photos');
    await fs.mkdir(photoDir, { recursive: true });
    const filename = `${requestId}.jpg`;
    const filePath = path.join(photoDir, filename);
    await fs.writeFile(filePath, buffer);

    const relativePath = path
      .relative(process.cwd(), filePath)
      .split(path.sep)
      .join('/');

    return `./${relativePath}`;
  }

  private async downloadPhotoBuffer(
    ctx: CustomSceneContext,
    photo: PhotoSize,
  ): Promise<Buffer> {
    try {
      const fileLink = await ctx.telegram.getFileLink(photo.file_id);
      const response = await fetch(fileLink.toString());

      if (!response.ok) {
        throw new Error(
          `Failed to download photo: ${response.status} ${response.statusText}`,
        );
      }

      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      console.error('[CnyWechatStrategy] Unable to download photo', error);
      throw new MissingAttachmentError(
        'Не удалось загрузить фотографию. Попробуйте отправить заявку снова.',
      );
    }
  }

  private async savePhotoToSceneState(
    photoPath: string,
    ctx: CustomSceneContext,
  ): Promise<void> {
    try {
      const state = ctx.scene.state as { cnyQrPhotoPath?: string };
      state.cnyQrPhotoPath = photoPath;
    } catch (error) {
      console.error('[CnyWechatStrategy] Failed to save photo path', error);
    }
  }
}
