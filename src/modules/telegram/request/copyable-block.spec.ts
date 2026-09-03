import { composeCopyableCaption } from './copyable-block';

describe('composeCopyableCaption', () => {
  const lines = [
    '✉️<b>Заявка номер:</b> <code>33058</code>',
    '🔖<b>Валюта:</b> UAH IBAN',
    '💵<b>Сумма:</b> <code>89620</code> UAH',
    '💱<b>Курс:</b> <code>44.81</code>',
    '👤<b>Получатель:</b> <code>Калініна Ольга Миколаївна</code>',
    '🏦<b>IBAN:</b> <code>UA503220010000026008340104782</code>',
    '📋<b>ИНН:</b> <code>3202515224</code>',
  ];

  it('реквизиты уезжают одним блоком, шапка остаётся размеченной', () => {
    const text = composeCopyableCaption(lines);
    const block = text.split('<pre>')[1].replace('</pre>', '');

    expect(text).toContain('✉️<b>Заявка номер:</b> <code>33058</code>');
    expect(text).toContain('💱<b>Курс:</b> <code>44.81</code>');
    expect(block).toContain('💵Сумма: 89620 UAH');
    expect(block).toContain('🏦IBAN: UA503220010000026008340104782');
    expect(block).toContain('👤Получатель: Калініна Ольга Миколаївна');
  });

  it('внутри блока нет разметки — Telegram показал бы её как текст', () => {
    const block = composeCopyableCaption(lines).split('<pre>')[1];
    expect(block).not.toContain('<b>');
    expect(block).not.toContain('<code>');
  });

  it('курс и номер заявки в блок не попадают: их не копируют', () => {
    const block = composeCopyableCaption(lines).split('<pre>')[1];
    expect(block).not.toContain('Курс');
    expect(block).not.toContain('Заявка номер');
  });

  it('спецсимволы в реквизитах экранируются, а не рвут разметку', () => {
    const text = composeCopyableCaption([
      '✉️<b>Заявка номер:</b> <code>1</code>',
      '💬<b>Комментарий:</b> R&D <script>',
    ]);
    expect(text).toContain('💬Комментарий: R&amp;D &lt;script&gt;');
  });

  it('без реквизитов пустой <pre> не рисуем', () => {
    const text = composeCopyableCaption([
      '✉️<b>Заявка номер:</b> <code>1</code>',
      '💱<b>Курс:</b> <code>44.81</code>',
    ]);
    expect(text).not.toContain('<pre>');
  });

  it('чёрный список остаётся в шапке — это предупреждение, не реквизит', () => {
    const text = composeCopyableCaption([
      '✉️<b>Заявка номер:</b> <code>1</code>',
      '🚫Карта в чёрном списке: возврат',
      '💳<b>Номер карты:</b> <code>4441111122223333</code>',
    ]);
    const [header, block] = text.split('<pre>');
    expect(header).toContain('🚫Карта в чёрном списке: возврат');
    expect(block).toContain('💳Номер карты: 4441111122223333');
  });
});
