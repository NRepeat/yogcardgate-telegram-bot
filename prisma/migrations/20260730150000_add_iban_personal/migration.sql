-- UAH IBAN физлицо → физлицо
ALTER TYPE "PaymentMethodEnum" ADD VALUE IF NOT EXISTS 'IBAN_PERSONAL';
