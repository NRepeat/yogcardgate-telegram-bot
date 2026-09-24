import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTokenGuard } from '../request/api-token.guard';
import { RequestService } from '../request/request.service';
import { UtilsService } from '../utils/utils.service';
import { TelegramService } from './telegram.service';

type UploadedReceipt = { buffer: Buffer; mimetype: string };

type CompleteBody = {
  /** Telegram id оператора. Пусто — берём того, кто вёл заявку. */
  actorTgId?: string | number;
  closeAccount?: string;
  closeRate?: string;
  closeFee?: string;
  closeOrderId?: string;
};

/**
 * Ручное закрытие заявки в обход бота.
 *
 * Нужен, когда визард выплаты не дошёл до конца: заявка висит в ACCEPTED,
 * карточки остаются с «в работе», и в партнёрский отчёт она не попадает —
 * тот берёт только COMPLETED по `completedAt`. Эндпоинт делает ровно то же,
 * что и последний шаг визарда, тем же кодом.
 *
 * POST /api/request/:id/complete
 *   x-api-token: <API_TOKEN>
 *   multipart: receipts[] — квитанции, 0..N картинок (несколько склеиваются
 *              в одну сетку, как это делает бот)
 *   поля: actorTgId, closeAccount, closeRate, closeFee, closeOrderId
 */
@Controller('api/request')
@UseGuards(ApiTokenGuard)
export class RequestCompleteController {
  constructor(
    private readonly requestService: RequestService,
    private readonly telegramService: TelegramService,
    private readonly utilsService: UtilsService,
  ) {}

  @Post(':id/complete')
  @UseInterceptors(FilesInterceptor('receipts', 10))
  async complete(
    @Param('id') id: string,
    @UploadedFiles() receipts: UploadedReceipt[] = [],
    @Body() body: CompleteBody = {},
  ) {
    const request = await this.requestService.findById(id);
    if (!request) {
      throw new HttpException(`Заявка ${id} не найдена`, HttpStatus.NOT_FOUND);
    }
    // Повторный вызов не переписывает completedAt: иначе заявка уедет в
    // следующий отчёт вторым разом, а партнёр увидит её дважды.
    if (request.status === 'COMPLETED') {
      throw new HttpException(
        `Заявка ${id} уже закрыта ${request.completedAt?.toISOString() ?? ''}`.trim(),
        HttpStatus.CONFLICT,
      );
    }

    const actorTgId = Number(
      body.actorTgId ?? request.activeUser?.telegramId ?? 0,
    );
    if (!actorTgId) {
      throw new HttpException(
        'Некому записать выплату: заявку никто не вёл, передайте actorTgId',
        HttpStatus.BAD_REQUEST,
      );
    }

    const images = receipts
      .filter((f) => f?.buffer?.length && f.mimetype?.startsWith('image/'))
      .map((f) => f.buffer);
    const buffer = images.length
      ? await this.utilsService.mergeImagesGrid(images)
      : undefined;

    // Площадку закрытия пишем только целиком: курс без площадки в отчёт не
    // ложится, а половина полей хуже, чем их отсутствие.
    const close =
      body.closeAccount && body.closeRate
        ? {
            account: body.closeAccount,
            rate: body.closeRate,
            fee: body.closeFee ?? (await this.requestService.closeFeeFor(body.closeAccount)),
            orderId: body.closeOrderId ?? null,
          }
        : undefined;

    await this.telegramService.completeRequestAndRefreshCards(id, {
      actorTgId,
      receipt: buffer ? { buffer } : undefined,
      close,
    });

    const updated = await this.requestService.findById(id);
    return {
      id,
      status: updated?.status,
      completedAt: updated?.completedAt,
      payedBy: updated?.payedByUser?.username ?? null,
      receipts: images.length,
      cards: updated?.message?.length ?? 0,
    };
  }
}
