import { CurrencyEnum, PaymentMethodEnum } from '@prisma/client';
import { PaymentFormFactory } from './payment-form.factory';
import { GenericFormStrategy } from './strategies/generic-form.strategy';
import { UsdCardStrategy } from './strategies/usd-card.strategy';

// USD добавлен в GENERIC_CURRENCIES ради Zelle. Опасность одна: generic
// перехватит доллар целиком, если у метода вдруг не окажется своей стратегии
// раньше в списке — поэтому проверяем и Zelle, и что карта свою стратегию не
// потеряла.
describe('USD Zelle', () => {
  const generic = new GenericFormStrategy({} as never);

  it('форма направления описана: email, ФИО, сумма', () => {
    const form = PaymentFormFactory.getForm(
      CurrencyEnum.USD,
      PaymentMethodEnum.ZELLE,
    );
    expect(form?.fields.map((f) => f.label)).toEqual([
      'Email Zelle',
      'ФИО латиницей',
      'Сумма',
    ]);
  });

  it('заявку собирает generic-стратегия', () => {
    expect(generic.supports(CurrencyEnum.USD, PaymentMethodEnum.ZELLE)).toBe(
      true,
    );
  });

  it('у карты USD остаётся своя стратегия — она в списке раньше generic', () => {
    const card = new UsdCardStrategy({} as never);
    expect(card.supports(CurrencyEnum.USD, PaymentMethodEnum.CARD)).toBe(true);
  });
});
