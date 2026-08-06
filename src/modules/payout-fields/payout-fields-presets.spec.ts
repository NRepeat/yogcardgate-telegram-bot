import { parseFieldsCommand, UAH_GROUP } from './payout-fields.presets';
import { boxHash } from './box-api.service';

describe('/fields — разбор команды', () => {
  it('без аргументов — список', () => {
    expect(parseFieldsCommand('/fields')).toEqual({ kind: 'list' });
  });

  it('один аргумент — показать', () => {
    expect(parseFieldsCommand('/fields corpuah')).toEqual({
      kind: 'show',
      targets: ['CORPUAH'],
    });
  });

  it('по умолчанию только активные роуты', () => {
    expect(parseFieldsCommand('/fields P24UAH card')).toMatchObject({ allRoutes: false });
  });

  it('флаг all включает выключенные роуты', () => {
    expect(parseFieldsCommand('/fields uah card all')).toMatchObject({
      preset: 'card',
      allRoutes: true,
    });
  });

  it('пресет card тянет карточный курс', () => {
    expect(parseFieldsCommand('/fields CARDUAH card')).toEqual({
      kind: 'set',
      targets: ['CARDUAH'],
      fields: ['card_number', 'full_name'],
      preset: 'card',
      parser: 'USDT/CARDUAH',
      allRoutes: false,
    });
  });

  it('по умолчанию только активные роуты', () => {
    expect(parseFieldsCommand('/fields P24UAH card')).toMatchObject({
      allRoutes: false,
    });
  });

  it('флаг all включает и выключенные роуты', () => {
    expect(parseFieldsCommand('/fields uah card all')).toMatchObject({
      preset: 'card',
      allRoutes: true,
    });
  });

  it('пресет iban тянет айбановый курс', () => {
    const cmd = parseFieldsCommand('/fields P24UAH iban');
    expect(cmd).toMatchObject({ kind: 'set', parser: 'USDT/WIREUAH' });
  });

  it('ручной список полей курс не двигает', () => {
    expect(parseFieldsCommand('/fields CORPUAH iban, inn')).toEqual({
      kind: 'set',
      targets: ['CORPUAH'],
      fields: ['iban', 'inn'],
    });
  });

  it('uah = карта + банки, без Счета компании и Банковского счета', () => {
    const cmd = parseFieldsCommand('/fields uah card');
    expect((cmd as { targets: string[] }).targets).toEqual(UAH_GROUP);
    expect(UAH_GROUP).toContain('CARDUAH');
    expect(UAH_GROUP).toHaveLength(13);
    expect(UAH_GROUP).not.toContain('CORPUAH');
    expect(UAH_GROUP).not.toContain('WIREUAH');
  });

  it('off выключает набор', () => {
    expect(parseFieldsCommand('/fields WIREUAH off')).toEqual({
      kind: 'off',
      targets: ['WIREUAH'],
    });
  });

  it('мусорное поле — ошибка', () => {
    const cmd = parseFieldsCommand('/fields CORPUAH iban,kP9X3');
    expect(cmd.kind).toBe('error');
    expect((cmd as { message: string }).message).toContain('kP9X3');
  });

  it('мусорный код направления — ошибка', () => {
    expect(parseFieldsCommand('/fields ../../etc fop').kind).toBe('error');
  });
});

describe('подпись запроса в админку обменника', () => {
  // Эталон посчитан реализацией box/generateHash.js — подпись должна совпадать,
  // иначе админка ответит 401 и курс не переключится.
  it('совпадает с box/generateHash.js', () => {
    expect(boxHash({ limit: 5000, time: 1 }, {}, 'secret')).toBe(
      '4d1ebaab377c19f9296df3fbac2618a1d557c821f31a18e1ecf63645f5747d89',
    );
  });
});
