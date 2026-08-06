import { isPayoutFieldKey, matchPreset } from './payout-fields.constants';

describe('payout-fields', () => {
  it('пропускает только ключи плагина', () => {
    expect(isPayoutFieldKey('iban')).toBe(true);
    expect(isPayoutFieldKey('inn')).toBe(true);
    expect(isPayoutFieldKey('kP9X31710759953331')).toBe(false);
    expect(isPayoutFieldKey('')).toBe(false);
  });

  it('матчит xml по самому длинному префиксу', () => {
    const presets = [{ xml: 'CORPUAH' }, { xml: 'CORPUAH2' }, { xml: 'WIREUAH' }];
    expect(matchPreset(presets, 'CORPUAH')?.xml).toBe('CORPUAH');
    expect(matchPreset(presets, 'CORPUAH2')?.xml).toBe('CORPUAH2');
    expect(matchPreset(presets, 'corpuah3')?.xml).toBe('CORPUAH');
    expect(matchPreset(presets, 'CARDUAH')).toBeNull();
  });
});
