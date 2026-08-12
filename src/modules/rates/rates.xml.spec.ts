import { buildRatesXml } from './rates.api.controller';

describe('buildRatesXml', () => {
  it('groups by xml code, prices the $350 tier, merges amount ranges', () => {
    const xml = buildRatesXml(
      [
        { xml: 'CARDUAH', rate: 44.15, minAmount: 2000, maxAmount: 9999 },
        { xml: 'CARDUAH', rate: 44.65, minAmount: 10000, maxAmount: 49999.99 },
        { xml: 'CARDUAH', rate: 44.7, minAmount: 50000, maxAmount: 0 },
        { xml: null, rate: 1, minAmount: 1, maxAmount: 1 },
      ],
      '2026-07-02T00:00:00.000Z',
    );

    expect(xml).toContain('<rates created="2026-07-02T00:00:00.000Z">');
    expect(xml.match(/<item>/g)).toHaveLength(1);
    expect(xml).toContain('<from>USDTTRC20</from>');
    expect(xml).toContain('<to>CARDUAH</to>');
    expect(xml).toContain('<in>1</in>');
    // 350 USD x 44.15 = 15452 UAH -> the [10000, 49999.99] tier
    expect(xml).toContain('<out>44.65</out>');
    expect(xml).toContain('<minamount>2000</minamount>');
    // maxAmount 0 = unbounded tier -> 1M cap
    expect(xml).toContain('<maxamount>1000000</maxamount>');
  });

  it('picks the upper tier when a method has only two of them', () => {
    const xml = buildRatesXml(
      [
        { xml: 'CORPUAH', rate: 45.2, minAmount: 2000, maxAmount: 9999 },
        { xml: 'CORPUAH', rate: 45.6, minAmount: 10000, maxAmount: 0 },
      ],
      '2026-08-12T00:00:00.000Z',
    );

    expect(xml).toContain('<out>45.6</out>');
  });

  it('stays on the low tier when the top one is out of our reach', () => {
    // 350 USD x 420 = 147000 KZT — the 300000+ tier is not something we hit
    const xml = buildRatesXml(
      [
        { xml: 'CARDKZT', rate: 420, minAmount: 9000, maxAmount: 299999 },
        { xml: 'CARDKZT', rate: 450, minAmount: 300000, maxAmount: 0 },
      ],
      '2026-08-12T00:00:00.000Z',
    );

    expect(xml).toContain('<out>420</out>');
  });

  it('falls back to the lowest tier when the order floor is below all of them', () => {
    // 350 USD x 0.855 = 299 EUR, under the 500 EUR entry tier
    const xml = buildRatesXml(
      [
        { xml: 'SEPAEUR', rate: 0.855, minAmount: 500, maxAmount: 999 },
        { xml: 'SEPAEUR', rate: 0.86, minAmount: 1000, maxAmount: 0 },
      ],
      '2026-08-12T00:00:00.000Z',
    );

    expect(xml).toContain('<out>0.855</out>');
  });

  it('follows the vendor order floor when it is raised', () => {
    const tiers = [
      { xml: 'CARDUAH', rate: 44.15, minAmount: 2000, maxAmount: 9999 },
      { xml: 'CARDUAH', rate: 44.65, minAmount: 10000, maxAmount: 49999.99 },
      { xml: 'CARDUAH', rate: 44.7, minAmount: 50000, maxAmount: 0 },
    ];

    // 1500 USD x 44.15 = 66225 UAH -> the 50000+ tier
    expect(buildRatesXml(tiers, 'x', 1500)).toContain('<out>44.7</out>');
    // 100 USD x 44.15 = 4415 UAH -> the entry tier
    expect(buildRatesXml(tiers, 'x', 100)).toContain('<out>44.15</out>');
  });
});
