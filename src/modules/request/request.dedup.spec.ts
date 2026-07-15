import { PaymentMethodEnum, Status } from '@prisma/client';
import { buildDuplicateWhere } from './request.dedup';

describe('buildDuplicateWhere', () => {
  const since = new Date('2026-07-15T07:30:00.000Z');
  const base = { vendorId: 'v1', amount: 13110, since };

  it('keys on the card destination when a card is present', () => {
    const where = buildDuplicateWhere({
      ...base,
      method: PaymentMethodEnum.CARD,
      card: '5168752085173667',
    });
    expect(where).toEqual({
      vendorId: 'v1',
      amount: 13110,
      status: { not: Status.FAILED },
      createdAt: { gte: since },
      methods: {
        some: {
          method: PaymentMethodEnum.CARD,
          cardDetails: { is: { card: '5168752085173667' } },
        },
      },
    });
  });

  it('keys on the iban destination when only an iban is present', () => {
    const where = buildDuplicateWhere({
      ...base,
      method: PaymentMethodEnum.IBAN,
      iban: 'UA123456789012345678901234567',
    });
    expect(where?.methods.some).toMatchObject({
      method: PaymentMethodEnum.IBAN,
      ibanDetails: { is: { iban: 'UA123456789012345678901234567' } },
    });
  });

  it('prefers the card over iban when both are given', () => {
    const where = buildDuplicateWhere({
      ...base,
      method: PaymentMethodEnum.CARD,
      card: '1111',
      iban: 'UA999',
    });
    expect(where?.methods.some).toHaveProperty('cardDetails');
    expect(where?.methods.some).not.toHaveProperty('ibanDetails');
  });

  it('returns null (no dedup) when there is no card/iban destination', () => {
    expect(
      buildDuplicateWhere({ ...base, method: PaymentMethodEnum.CARD }),
    ).toBeNull();
  });
});
