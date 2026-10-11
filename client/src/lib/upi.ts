import type { Settings } from './types';

/** True when the salon has entered a UPI ID in Admin -> Content -> Contact. */
export const isUpiEnabled = (settings: Pick<Settings, 'upiId'>) => Boolean(settings.upiId && settings.upiId.includes('@'));

/**
 * Standard UPI deep link understood by GPay, PhonePe, Paytm, BHIM, bank apps.
 * pa = payee UPI id, pn = payee name, am = amount, tn = note, tr = reference
 */
export function buildUpiLink({ pa, pn, am, tn, tr }: { pa: string; pn: string; am: number; tn?: string; tr?: string }) {
  const p = new URLSearchParams({ pa, pn, am: am.toFixed(2), cu: 'INR' });
  if (tn) p.set('tn', tn.slice(0, 50));
  if (tr) p.set('tr', tr.slice(0, 35));
  return `upi://pay?${p.toString()}`;
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
