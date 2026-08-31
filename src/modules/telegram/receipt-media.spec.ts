import { DEFAULT_PHOTO, isFileId, photoMedia } from './photo-source';

describe('квитанция через file_id', () => {
  it('file_id отдаётся строкой — без повторной заливки байтов', () => {
    const fileId = 'AgACAgIAAxkBAAIB_2jU';
    expect(isFileId(fileId)).toBe(true);
    expect(photoMedia(fileId)).toBe(fileId);
  });

  it('пути и ссылки file_id не считаются', () => {
    expect(isFileId('./storage/request-photos/a.jpg')).toBe(false);
    expect(isFileId('/tmp/a.jpg')).toBe(false);
    expect(isFileId('https://example.com/a.jpg')).toBe(false);
    expect(isFileId('')).toBe(false);
    expect(isFileId(null)).toBe(false);
  });

  it('для пути отдаётся поток файла, а пропавший файл подменяется заглушкой', () => {
    const media = photoMedia('./storage/request-photos/gone.jpg') as {
      source: { path: string };
    };
    expect(media.source).toBeDefined();
    expect(String(media.source.path)).toContain(DEFAULT_PHOTO.replace('./', ''));
  });
});
