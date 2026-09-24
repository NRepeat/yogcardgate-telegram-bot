import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { resolvePhotoPath, photoMedia, DEFAULT_PHOTO } from './photo-source';

describe('resolvePhotoPath', () => {
  const dir = mkdtempSync(join(tmpdir(), 'photo-source-'));
  const existing = join(dir, 'receipt.jpg');
  writeFileSync(existing, 'jpeg');

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('отдаёт файл квитанции, когда он на месте', () => {
    expect(resolvePhotoPath(existing)).toBe(existing);
  });

  // Файл не пережил пересоздание контейнера: раньше тут летел ENOENT и
  // хендлер падал, не дав закрыть заявку.
  it('подставляет заглушку вместо пропавшего файла', () => {
    expect(resolvePhotoPath(join(dir, 'gone.jpg'))).toBe(DEFAULT_PHOTO);
    expect(resolvePhotoPath(undefined)).toBe(DEFAULT_PHOTO);
    expect(resolvePhotoPath('')).toBe(DEFAULT_PHOTO);
  });
});

describe('photoMedia', () => {
  // В photoUrl заявки лежит file_id: как `{ source }` телеграф ищет такой
  // файл на диске, ловит ENOENT и роняет хендлер — кнопки «не нажимаются».
  it('file_id отдаёт строкой, а не файлом', () => {
    expect(photoMedia('AgACAgIAAyEGAATs6MjiAAIX_Wq1cKCd55mtL6L6K8O33j2K1DXl')).toBe(
      'AgACAgIAAyEGAATs6MjiAAIX_Wq1cKCd55mtL6L6K8O33j2K1DXl',
    );
  });

  it('путь отдаёт потоком', () => {
    const media = photoMedia('./src/assets/0056.jpg');
    expect(typeof media).toBe('object');
    (media as { source: { destroy(): void } }).source.destroy();
  });
});
