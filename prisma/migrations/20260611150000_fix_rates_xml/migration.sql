-- Backfill xml codes for existing rates that were created with wrong/missing xml.
-- New rates get correct codes from XML_MAP; this fixes rows already in the DB.

UPDATE "Rates" r SET "xml" = 'WISEEUR'
FROM "PaymentMethod" pm, "Currency" c
WHERE r."paymentMethodId" = pm."id" AND r."currencyId" = c."id"
  AND pm."nameEn" = 'WISE' AND c."name" = 'EUR';

UPDATE "Rates" r SET "xml" = 'WIRETHB'
FROM "PaymentMethod" pm, "Currency" c
WHERE r."paymentMethodId" = pm."id" AND r."currencyId" = c."id"
  AND pm."nameEn" = 'BANK' AND c."name" = 'THB';

UPDATE "Rates" r SET "xml" = 'WIRECZK'
FROM "PaymentMethod" pm, "Currency" c
WHERE r."paymentMethodId" = pm."id" AND r."currencyId" = c."id"
  AND pm."nameEn" = 'BANK' AND c."name" = 'CZK';

UPDATE "Rates" r SET "xml" = 'CARDAZN'
FROM "PaymentMethod" pm, "Currency" c
WHERE r."paymentMethodId" = pm."id" AND r."currencyId" = c."id"
  AND pm."nameEn" = 'CARD' AND c."name" = 'AZN';
