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
