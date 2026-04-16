-- AlterTable
ALTER TABLE "Rates" ADD COLUMN "xml" TEXT;

-- Populate xml based on payment method + currency
UPDATE "Rates" r
SET "xml" = m.xml_code
FROM (
  SELECT
    rt.id,
    CASE
      WHEN pm."nameEn" = 'CARD' AND c.code = 'UAH' THEN 'CARDUAH'
      WHEN pm."nameEn" = 'CARD' AND c.code = 'USD' THEN 'CARDUSD'
      WHEN pm."nameEn" = 'CARD' AND c.code = 'EUR' THEN 'CARDEUR'
      WHEN pm."nameEn" = 'CARD' AND c.code = 'KZT' THEN 'CARDKZT'
      WHEN pm."nameEn" = 'CARD' AND c.code = 'AZN' THEN 'WIREAZN'
      WHEN pm."nameEn" = 'CARD' AND c.code = 'CNY' THEN 'CARDCNY'
      WHEN pm."nameEn" = 'IBAN' AND c.code = 'UAH' THEN 'WIREUAH'
      WHEN pm."nameEn" = 'IBAN' AND c.code = 'EUR' THEN 'SEPAEUR'
      WHEN pm."nameEn" = 'IBAN' AND c.code = 'AED' THEN 'WIREAED'
      WHEN pm."nameEn" = 'IBAN' AND c.code = 'PLN' THEN 'WIREPLN'
      WHEN pm."nameEn" = 'IBAN' AND c.code = 'TRY' THEN 'WIRETRY'
      WHEN pm."nameEn" = 'WISE' THEN 'WISEUSD'
      WHEN pm."nameEn" = 'SKRILL' AND c.code = 'USD' THEN 'SKLUSD'
      WHEN pm."nameEn" = 'SKRILL' AND c.code = 'EUR' THEN 'SKLEUR'
      WHEN pm."nameEn" = 'PAYPAL' AND c.code = 'USD' THEN 'PPUSD'
      WHEN pm."nameEn" = 'KZT_KASPI_BANK' THEN 'KSPBKZT'
      WHEN pm."nameEn" = 'KZT_OTHER_BANKS' THEN 'CARDKZT'
      WHEN pm."nameEn" = 'CNY_ALIPAY' THEN 'ALPCNY'
      WHEN pm."nameEn" = 'CNY_WECHAT' THEN 'WCTCNY'
      WHEN pm."nameEn" = 'CNY_CARD' THEN 'CARDCNY'
      ELSE NULL
    END AS xml_code
  FROM "Rates" rt
  JOIN "PaymentMethod" pm ON rt."paymentMethodId" = pm.id
  JOIN "Currency" c ON rt."currencyId" = c.id
) m
WHERE r.id = m.id;
