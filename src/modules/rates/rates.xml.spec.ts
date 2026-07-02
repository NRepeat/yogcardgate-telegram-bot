import { buildRatesXml } from './rates.api.controller';

describe('buildRatesXml', () => {
  it('groups by xml code, picks middle-tier rate, merges amount ranges', () => {
    const xml = buildRatesXml(
      [
        { xml: 'CARDUAH', rate: 40, minAmount: 100, maxAmount: 500 },
        { xml: 'CARDUAH', rate: 41, minAmount: 500, maxAmount: 1000 },
        { xml: 'CARDUAH', rate: 42, minAmount: 1000, maxAmount: 0 },
        { xml: null, rate: 1, minAmount: 1, maxAmount: 1 },
      ],
      '2026-07-02T00:00:00.000Z',
    );

    expect(xml).toContain('<rates created="2026-07-02T00:00:00.000Z">');
    expect(xml.match(/<item>/g)).toHaveLength(1);
    expect(xml).toContain('<from>USDTTRC20</from>');
    expect(xml).toContain('<to>CARDUAH</to>');
    expect(xml).toContain('<in>1</in>');
    // middle of [1000, 500, 100] by minAmount desc -> rate 41
    expect(xml).toContain('<out>41</out>');
    expect(xml).toContain('<minamount>100</minamount>');
    // maxAmount 0 = unbounded tier -> 1M cap
    expect(xml).toContain('<maxamount>1000000</maxamount>');
  });
});
