import { PaymentMethodEnum } from '@prisma/client';
import { FullRequestType } from 'src/types/types';
import { RequestMessageFactory } from './request-message.factory';

/** Заявка на 44 676 грн: 1001.70 USDT по курсу 44.6 — как в рабочей группе. */
function request(): FullRequestType {
  return {
    id: 'cmtlluvfm002ppa01fvlylm0d',
    amount: 44676,
    rate: '44.6',
    currency: { nameEn: 'UAH', name: 'UAH' },
  } as unknown as FullRequestType;
}

const ibanMethod = {
  method: PaymentMethodEnum.IBAN,
  ibanDetails: {
    iban: 'UA503220010000026008340104782',
    name: 'Калініна Ольга Миколаївна',
    inn: '3202515224',
  },
} as never;

const cardMethod = {
  method: PaymentMethodEnum.CARD,
  cardDetails: {
    card: '5375411112229447',
    bank: { bankName: 'Монобанк' },
  },
} as never;

function caption(method: never, access: 'WORKER' | 'PUBLIC' = 'WORKER'): string {
  return RequestMessageFactory.create(access, request(), method)?.text ?? '';
}

describe('копируемый блок в карточке заявки', () => {
  it('IBAN: реквизиты уезжают блоком, сумма в гривне — первой строкой', () => {
    const block = caption(ibanMethod).split('<pre>')[1].replace('</pre>', '');

    expect(block.split('\n')[0]).toBe('💵Сумма: 44676 UAH');
    expect(block).toContain('🏦IBAN: UA503220010000026008340104782');
    expect(block).toContain('👤Получатель: Калініна Ольга Миколаївна');
    expect(block).toContain('📋ИНН: 3202515224');
  });

  it('карта: блока нет — оператор копирует один номер', () => {
    const text = caption(cardMethod);

    expect(text).not.toContain('<pre>');
    expect(text).toContain('💳<b>Номер карты:</b> <code>5375411112229447</code>');
    expect(text).toContain('💵<b>Сумма:</b> <code>44676</code> UAH');
  });

  it('клиенту блок не показываем даже по IBAN', () => {
    expect(caption(ibanMethod, 'PUBLIC')).not.toContain('<pre>');
  });

  it('курс и номер заявки остаются в шапке, размеченными', () => {
    const [header] = caption(ibanMethod).split('<pre>');

    expect(header).toContain('💱<b>Курс:</b> <code>44.6</code>');
    expect(header).toContain('✉️<b>Заявка номер:</b>');
  });
});
