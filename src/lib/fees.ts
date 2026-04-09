export function roundToCents(amount: number): number {
  if (!Number.isFinite(amount)) return NaN;
  return Math.round(amount * 100) / 100;
}

export function calculateMonexUsFee(quantity: number, price: number): number {
  const notional = quantity * price;
  if (!Number.isFinite(notional) || notional <= 0) return 0;

  const raw = notional * 0.00495;
  const clamped = Math.min(22, Math.max(0, raw));
  return roundToCents(clamped);
}

