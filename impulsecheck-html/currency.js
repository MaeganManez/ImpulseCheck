/* ============================================================
   currency.js — ImpulseCheck shared currency helper
   Loaded by every page. Call getCurrency() to get the
   current symbol, or fmt(amount) to format a number.
   ============================================================ */

const CURRENCY_MAP = {
  PHP: '₱',  USD: '$',   EUR: '€',   GBP: '£',
  JPY: '¥',  KRW: '₩',  CNY: '¥',   SGD: 'S$',
  AUD: 'A$', CAD: 'C$',  INR: '₹',   MYR: 'RM',
  IDR: 'Rp', THB: '฿',   VND: '₫',   AED: 'د.إ',
  SAR: '﷼',  BRL: 'R$',  MXN: '$',   ZAR: 'R',
};

function getCurrencyCode()   { return localStorage.getItem('ic_currency') || 'PHP'; }
function getCurrencySymbol() { return CURRENCY_MAP[getCurrencyCode()] || '₱'; }

/**
 * Format a number with the current currency symbol.
 * fmt(1200)      → "₱ 1,200"
 * fmt(1200, true) → "₱1,200" (no space, for compact use)
 */
function fmt(amount, compact = false) {
  const sym = getCurrencySymbol();
  const num = Number(amount).toLocaleString();
  return compact ? sym + num : sym + ' ' + num;
}

/** Format with decimals (for budget preview) */
function fmtDec(amount, decimals = 2) {
  const sym = getCurrencySymbol();
  return sym + Number(amount).toLocaleString('en', { minimumFractionDigits: decimals });
}
