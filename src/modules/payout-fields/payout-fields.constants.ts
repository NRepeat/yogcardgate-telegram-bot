// Ключи полей, которые понимает payout-плагин обменника
// (payout-custom-manual-tg-bot: payout/fields/lib/fieldFactory.js — `_id` каждого поля).
// Пресет с ключом вне этого списка плагин отрисовать не сможет, поэтому пишем только их.
export const PAYOUT_FIELD_KEYS = [
  'account_number',
  'amount',
  'bank_account',
  'bank_name',
  'card_number',
  'country',
  'cpf',
  'cvu_cbu',
  'full_name',
  'iban',
  'idram_account',
  'ifsc',
  'inn',
  'payment_note',
  'payout_email',
  'paytm_wallet',
  'phone',
  'photo',
  'pix_keys',
  'recipient_name',
  'revtag',
  'separate_direction',
  'sort_code',
  'telegram',
  'upi_id',
  'wallet_address',
] as const;

export type PayoutFieldKey = (typeof PAYOUT_FIELD_KEYS)[number];

export const isPayoutFieldKey = (key: unknown): key is PayoutFieldKey =>
  typeof key === 'string' && (PAYOUT_FIELD_KEYS as readonly string[]).includes(key);

/** Плагин матчит xml по префиксу, поэтому CORPUAH2 обслуживается пресетом CORPUAH. */
export const matchPreset = <T extends { xml: string }>(
  presets: T[],
  xml: string,
): T | null => {
  const target = xml.toUpperCase();
  const hits = presets.filter((p) => target.startsWith(p.xml));
  if (!hits.length) return null;
  return hits.sort((a, b) => b.xml.length - a.xml.length)[0];
};
