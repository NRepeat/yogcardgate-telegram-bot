import { promises as fs } from 'fs';
import * as path from 'path';
import { PaymentMethodEnum, AccessType } from '@prisma/client';
import { FullRequestType, CustomSceneContext } from 'src/types/types';
import {
  CnyBaseStrategy,
  CnyStrategyDependencies,
  CreateRequestParams,
  ParsedStrategyInput,
  MissingAttachmentError,
} from './cny-base.strategy';
import { PhotoSize } from 'telegraf/typings/core/types/typegram';

interface CnyQrParsedInput extends ParsedStrategyInput {
  identifier: string;
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
    const blocks = message
      .split(/\n{2,}/)
      .map((block) =>
        block
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
      )
      .filter((lines) => lines.length > 0);

    if (blocks.length === 0) {
      const single = message
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (single.length) {
        blocks.push(single);
      }
    }

    if (blocks.length === 0) {
      return {
        success: false as const,
        error: 'Укажите сумму, идентификатор и ФИО получателя.',
      };
    }

    const parsed: CnyQrParsedInput[] = [];
    for (const lines of blocks) {
      if (lines.length < 2) {
        return {
          success: false as const,
          error: 'Для Alipay требуется минимум две строки: сумма и идентификатор.',
        };
      }

      const amountLine = lines[0];
      const identifier = lines[1];
      const recipient = lines[2] ?? undefined;
      const comment = lines.slice(3).join('\n').trim() || undefined;

      const amount = this.tryParseAmount(amountLine);
      if (!amount || amount <= 0) {
        return {
          success: false as const,
          error: 'Сумма должна быть положительным числом.',
        };
      }

      if (!identifier || identifier.length < 3) {
        return {
          success: false as const,
          error: 'Укажите идентификатор получателя Alipay.',
        };
      }

      parsed.push({ amount, identifier, recipient, comment });
    }

    return {
      success: true as const,
      data: parsed,
    };
  }

  protected async createRequest({
    ctx,
    currencyId,
    vendorId,
    rate,
    parsed,
  }: CreateRequestParams & { parsed: CnyQrParsedInput }): Promise<FullRequestType> {
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
          identifier: parsed.identifier,
          comment: parsed.recipient || parsed.comment ? [parsed.recipient, parsed.comment]
            .filter(Boolean)
            .join('\n')
            : null,
        },
      },
    });

    // Save photo locally and store path in scene state
    const photoPath = await this.savePhotoForRequest(photoBuffer, request.id);
    await this.savePhotoToDatabase(request.id, photoPath, ctx);

    return request as unknown as FullRequestType;
  }

  protected buildDetails(data: CnyQrParsedInput): string {
    const lines = [
      'Тип: CNY Wechat',
      `Идентификатор: ${data.identifier}`,
      `Сумма: ${data.amount} CNY`,
    ];
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

  private getWizardPayload(ctx: CustomSceneContext) {
    const state = ctx.scene.state as {
      cnyQrPayload?: {
        text?: string;
        photo?: PhotoSize;
      };
    };

    if (!state.cnyQrPayload) {
      state.cnyQrPayload = {};
    }

    return state.cnyQrPayload;
  }

  private extractPhotoOrThrow(ctx: CustomSceneContext): PhotoSize {
    const payload = this.getWizardPayload(ctx);
    const message = ctx.message as { photo?: PhotoSize[] } | undefined;
    const messagePhoto =
      message && Array.isArray(message.photo) && message.photo.length > 0
        ? message.photo[message.photo.length - 1]
        : undefined;

    if (messagePhoto) {
      payload.photo = messagePhoto;
      return messagePhoto;
    }

    if (payload.photo) {
      return payload.photo;
    }

    throw new MissingAttachmentError(
      'Пожалуйста, прикрепите фотографию QR-кода Wechat получателя.',
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
      console.error('[CnyWechatStrategy] Unable to download photo from message', error);
      throw new MissingAttachmentError(
        'Не удалось загрузить фотографию QR-кода Wechat. Попробуйте отправить заявку снова.',
      );
    }
  }

  private async savePhotoToDatabase(
    requestId: string,
    photoPath: string,
    ctx: CustomSceneContext,
  ): Promise<void> {
    try {
      // Store the photo path in the scene state so it can be retrieved later
      // when the actual message is sent and we have a real messageId
      const state = ctx.scene.state as {
        cnyQrPhotoPath?: string;
      };
      state.cnyQrPhotoPath = photoPath;
      
      console.log(`[CnyWechatStrategy] Photo path stored in scene state: ${photoPath}`);
    } catch (error) {
      console.error('[CnyWechatStrategy] Failed to save photo path to scene state', error);
      // Don't throw here as the request is already created successfully
    }
  }

}
