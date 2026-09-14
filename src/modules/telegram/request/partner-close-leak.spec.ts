import { PaymentMethodEnum } from '@prisma/client';
import { FullRequestType } from 'src/types/types';
import { MenuFactory } from '../telegram-keyboards';

/**
 * Деньги: карточка в группе партнёра (PUBLIC) не должна нести ни курса
 * закрытия, ни площадки, ни ордера, ни комиссии — по курсу закрытия и курсу
 * клиента считается наш заработок на его же заявке.
 *
 * Отдельно от request-message.close-privacy.spec: там проверяется рендер,
 * здесь — путь, которым карточку реально шлют (`MenuFactory` → `done()`),
 * со всеми состояниями меню. finishClose с недавних пор отдаёт сюда заявку
 * уже с заполненным закрытием, поэтому фильтр стал единственной защитой.
 */
const method = {
  method: PaymentMethodEnum.CARD,
  cardDetails: { card: '5375411112229447', bank: { bankName: 'Монобанк' } },
} as never;

const closedRequest = (): FullRequestType =>
  ({
    id: 'cmu19xwcd0035rt01v0yck9k6',
    // меню само выбирает метод из заявки: без него рендер уходит в
    // fallback-подпись и тест проверяет не тот путь
    methods: [method],
    paymentMethod: { nameEn: PaymentMethodEnum.CARD },
    amount: 49159,
    rate: '45.8',
    currency: { nameEn: 'UAH', name: 'UAH' },
    vendor: { title: 'YZ_07' },
    activeUser: { username: 'aa_wrld22' },
    closeAccount: 'binance',
    closeRate: '46.21',
    closeFee: '0.07',
    closeOrderId: '22932805985110179840',
  }) as unknown as FullRequestType;

const partnerRequest = () =>
  ({
    ...closedRequest(),
    closeAccount: 'partner:uachanger',
  }) as unknown as FullRequestType;

const SECRETS = [
  '46.21',
  'Binance',
  'binance',
  'uachanger',
  '0.07',
  '22932805985110179840',
  'Закрытие',
];

describe('партнёру не видно, чем закрыли его заявку', () => {
  it.each(['done', 'inProcess', 'inWork', 'canceled'] as const)(
    'PUBLIC-карточка (%s) молчит про закрытие',
    (state) => {
      const menu = MenuFactory.createPublicMenu(closedRequest(), '');
      const caption = (menu as never as Record<string, () => { caption: string }>)
        [state]?.()?.caption;
      if (caption === undefined) return; // состояния нет — проверять нечего
      for (const secret of SECRETS) {
        expect(caption).not.toContain(secret);
      }
      // курс клиента остаётся: его партнёр и так знает
      expect(caption).toContain('45.8');
    },
  );

  it('закрытие у партнёра по имени — тоже не утекает', () => {
    const caption = MenuFactory.createPublicMenu(partnerRequest(), '').done()
      .caption;
    expect(caption).not.toContain('uachanger');
    expect(caption).not.toContain('Закрытие');
  });

  it('оператору и админу закрытие видно — иначе правка бессмысленна', () => {
    const worker = MenuFactory.createWorkerMenu(closedRequest(), '').done()
      .caption;
    const admin = MenuFactory.createAdminMenu(closedRequest(), '').done()
      .caption;
    for (const caption of [worker, admin]) {
      expect(caption).toContain('Закрытие');
      expect(caption).toContain('46.21');
      expect(caption).toContain('22932805985110179840');
    }
  });
});
