import { PaymentMethodEnum, Status } from '@prisma/client';

// A resubmitted payout (same vendor + amount + destination card/iban within this
// window) is treated as a duplicate and never created twice. Prevents the
// double-payout seen when a vendor re-sends/edits the same lead.
export const DEDUP_WINDOW_MS = 10 * 60 * 1000;

// Pure where-builder for the duplicate lookup (unit-tested). Returns null when
// there is no card/iban destination to key on — such requests are not deduped.
// ponytail: only card/iban destinations are guarded (covers all card traffic +
// both API lead endpoints); other method types fall through unguarded.
export function buildDuplicateWhere(params: {
  vendorId: string;
  amount: number;
  method: PaymentMethodEnum;
  card?: string | null;
  iban?: string | null;
  since: Date;
}) {
  const destination = params.card
    ? { cardDetails: { is: { card: params.card } } }
    : params.iban
      ? { ibanDetails: { is: { iban: params.iban } } }
      : null;
  if (!destination) return null;
  return {
    vendorId: params.vendorId,
    amount: params.amount,
    status: { not: Status.FAILED }, // a failed lead may legitimately be retried
    createdAt: { gte: params.since },
    methods: { some: { method: params.method, ...destination } },
  };
}
