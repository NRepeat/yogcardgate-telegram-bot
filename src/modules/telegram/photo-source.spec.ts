import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { resolvePhotoPath, DEFAULT_PHOTO } from './photo-source';

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
