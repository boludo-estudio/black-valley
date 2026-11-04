// hustle-shell/src/money.js
// Money is always integer micro-units: 1_000_000 = 1.00. Currency changes display only.
// Source: studio.engine.io/docs/rgs (currency table, verified 2026-10-25). 46 fiat + XGC/XSC/XEC.
// Live table wins over older docs: KWD/JOD/TND/OMR/BHD = 3 decimals; DKK/NOK = "kr" after.

export const MICRO = 1_000_000;

// code: [symbol, decimals, symbolAfter]
export const CURRENCIES = Object.freeze({
  USD: ['$', 2], CAD: ['CA$', 2], JPY: ['¥', 0], EUR: ['€', 2], RUB: ['₽', 2], CNY: ['CN¥', 2],
  PHP: ['₱', 2], INR: ['₹', 2], IDR: ['Rp', 0], KRW: ['₩', 0], BRL: ['R$', 2], MXN: ['MX$', 2],
  DKK: ['kr', 2, true], PLN: ['zł', 2, true], VND: ['₫', 0, true], TRY: ['₺', 2], CLP: ['CLP', 0, true],
  ARS: ['ARS', 2, true], PEN: ['S/', 2],
  NGN: ['₦', 2], SAR: ['SAR', 2, true], ILS: ['₪', 2], AED: ['AED', 2, true], TWD: ['NT$', 2],
  NOK: ['kr', 2, true], KWD: ['KD', 3], JOD: ['JD', 3], CRC: ['₡', 2], TND: ['TND', 3, true],
  SGD: ['SG$', 2], MYR: ['RM', 2], OMR: ['OMR', 3, true], QAR: ['QAR', 2, true], BHD: ['BD', 3],
  PKR: ['₨', 2], EGP: ['EGP', 2, true], NZD: ['NZ$', 2], BOB: ['Bs', 2], GHS: ['GH₵', 2],
  KES: ['KSh', 2], MAD: ['MAD', 2, true], BAM: ['KM', 2], ISK: ['kr', 0, true], TZS: ['TSh', 2],
  UGX: ['USh', 0], XOF: ['CFA', 0, true],
  // Social casino currencies: never a $ sign. The live table prints XEC as "SC" too.
  XGC: ['GC', 2, true], XSC: ['SC', 2, true], XEC: ['SC', 2, true],
});

export const SOCIAL_CURRENCIES = new Set(['XGC', 'XSC', 'XEC']);

const normalise = code => {
  const c = String(code || '').toUpperCase();
  return c === 'GC' ? 'XGC' : c === 'SC' ? 'XSC' : c;
};

export function currencyMeta(code) {
  const c = normalise(code);
  const [symbol, decimals, after] = CURRENCIES[c] || [c, 2, true];   // unknown → "<amount> <CODE>"
  return {code: c, symbol, decimals, after: Boolean(after)};
}

function plain(value, minDecimals, maxDecimals) {
  return value.toLocaleString('en-GB', {minimumFractionDigits: minDecimals, maximumFractionDigits: maxDecimals});
}

/**
 * Micro-units → display text.
 * kind 'balance' uses the currency's own decimals; kind 'win' never hides a sub-cent part
 * (Engine: "in-game wins must show exact amounts", 3–4 decimals at $0.01 bets).
 */
export function formatMoney(micro, currency = 'USD', {kind = 'win'} = {}) {
  const m = currencyMeta(currency);
  const value = Number(micro) / MICRO;
  const max = kind === 'balance' ? m.decimals : Math.max(m.decimals, 6);
  const text = plain(value, m.decimals, max);
  if (!m.code || m.code === 'DEMO') return text;
  return m.after ? `${text} ${m.symbol}` : `${m.symbol}${text}`;
}

/** Bet levels the session allows: inside [minBet, maxBet], multiples of stepBet, sorted. */
export function usableBetLevels(config) {
  const {minBet, maxBet, stepBet, betLevels} = config;
  return [...new Set(betLevels)]
    .filter(v => Number.isSafeInteger(v) && v >= minBet && v <= maxBet && (!stepBet || v % stepBet === 0))
    .sort((a, b) => a - b);
}

/** Exact win for a bet and a book payout in hundredths of the bet, BigInt so nothing rounds. */
export function winFor(betMicro, hundredths) {
  return Number((BigInt(Math.round(betMicro)) * BigInt(Math.round(hundredths))) / 100n);
}
