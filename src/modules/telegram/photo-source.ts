import { createReadStream, existsSync } from 'fs';

export const DEFAULT_PHOTO = './src/assets/0056.jpg';

/**
 * Квитанции лежат файлами в storage/, и если файл не пережил пересоздание
 * контейнера, createReadStream бросает ENOENT — вместе с ним падает весь
 * хендлер апдейта, и заявку уже не закрыть. Отдаём заглушку.
 */
export const resolvePhotoPath = (photoUrl?: string | null): string =>
  photoUrl && existsSync(photoUrl) ? photoUrl : DEFAULT_PHOTO;

/** Источник фото для sendPhoto/editMessageMedia. */
export const photoSource = (photoUrl?: string | null) => ({
  source: createReadStream(resolvePhotoPath(photoUrl)),
});

/**
 * В photoUrl сообщения лежит либо путь к файлу, либо file_id квитанции,
 * которую Telegram уже хранит у себя. Пути начинаются с `.`/`/`, ссылки — с
 * http, всё остальное считаем file_id и отдаём строкой: так медиа обновляется
 * без повторной заливки байтов.
 */
export const isFileId = (photoUrl?: string | null): photoUrl is string =>
  !!photoUrl &&
  !photoUrl.startsWith('.') &&
  !photoUrl.startsWith('/') &&
  !photoUrl.startsWith('http');

/** Медиа для editMessageMedia: file_id строкой либо файл потоком. */
export const photoMedia = (photoUrl?: string | null) =>
  isFileId(photoUrl) ? photoUrl : photoSource(photoUrl);
