import { isPayoutFieldKey } from './payout-fields.constants';

/**
 * Именованные наборы полей формы выплаты. Курс следует за методом, поэтому у
 * пресета есть и парсер обменника: карта — USDT/CARDUAH, IBAN — USDT/WIREUAH.
 */
export const FIELD_PRESETS: Record<string, { fields: string[]; parser: string }> = {
  card: {
    fields: ['card_number', 'full_name'],
    parser: 'USDT/CARDUAH',
  },
  iban: {
    fields: ['iban', 'full_name', 'inn', 'payment_note'],
    parser: 'USDT/WIREUAH',
  },
  fop: {
    fields: ['iban', 'recipient_name', 'inn', 'payment_note'],
    parser: 'USDT/WIREUAH',
  },
};

/**
 * Групповая цель `uah`: Visa/Master Card + банки. «Счет компании» (CORPUAH)
 * и скрытый «Банковский счет» (WIREUAH) в группу НЕ входят — у них свой курс.
 */
export const UAH_GROUP = [
  'CARDUAH',
  'ABUAH',
  'IZIBUAH',
  'MONOBUAH',
  'OSDBUAH',
  'OTPBUAH',
  'P24UAH',
  'PMBBUAH',
  'RFBUAH',
  'SNBUAH',
  'SPBUAH',
  'TASBUAH',
  'USBUAH',
];

export type FieldsCommand =
  | { kind: 'list' }
  | { kind: 'show'; targets: string[] }
  | {
      kind: 'set';
      targets: string[];
      fields: string[];
      preset?: string;
      parser?: string;
      allRoutes?: boolean;
    }
  | { kind: 'off'; targets: string[] }
  | { kind: 'error'; message: string };

const resolveTargets = (target: string): string[] =>
  target.toLowerCase() === 'uah' ? UAH_GROUP : [target.toUpperCase()];

/** `/fields [ЦЕЛЬ] [пресет|поле,поле|off]` — разбор без побочных эффектов. */
export function parseFieldsCommand(text: string): FieldsCommand {
  const [, target, ...rest] = text.trim().split(/\s+/);
  if (!target) return { kind: 'list' };
  if (!/^[A-Za-z0-9]{2,20}$/.test(target)) {
    return { kind: 'error', message: `Плохой код направления: ${target}` };
  }

  const targets = resolveTargets(target);
  // `all` — курс менять и у выключенных роутов направления, по умолчанию только активные.
  const allRoutes = rest.some((r) => r.toLowerCase() === 'all');
  const arg = rest.filter((r) => r.toLowerCase() !== 'all').join('');
  if (!arg) return { kind: 'show', targets };
  if (arg.toLowerCase() === 'off') return { kind: 'off', targets };

  const preset = FIELD_PRESETS[arg.toLowerCase()];
  if (preset) {
    return {
      kind: 'set',
      targets,
      fields: preset.fields,
      preset: arg.toLowerCase(),
      parser: preset.parser,
      allRoutes,
    };
  }

  const fields = arg.split(',').map((f) => f.trim()).filter(Boolean);
  const bad = fields.filter((f) => !isPayoutFieldKey(f));
  if (!fields.length || bad.length) {
    return {
      kind: 'error',
      message: `Неизвестные поля: ${bad.join(', ') || arg}`,
    };
  }
  // Ручной набор полей курс не двигает — парсер остаётся прежним.
  return { kind: 'set', targets, fields };
}
