// Formato de moneda, números y fechas. Funciones puras (salvo la moneda activa).

// La persona elige si maneja pesos colombianos o dólares. El código ISO viaja al backend.
// COP: "$ 1.234.567" (sin decimales si no hay centavos: el peso casi no los usa).
// USD: "US$ 1,234.56" (siempre 2 decimales).
export const CURRENCIES = Object.freeze([
  { code: 'COP', label: 'Peso colombiano (COP)', prefix: '$ ', locale: 'es-CO', fractionDigits: 0 },
  { code: 'USD', label: 'Dólar estadounidense (USD)', prefix: 'US$ ', locale: 'en-US', fractionDigits: 2 },
]);
export const DEFAULT_CURRENCY = 'COP';

const byCode = (code) => CURRENCIES.find((c) => c.code === code);
let currency = byCode(DEFAULT_CURRENCY);
const formats = new Map();

export const setCurrency = (code) => {
  currency = byCode(code) ?? currency;
};
export const getCurrency = () => currency.code;

function formatNumber(value) {
  // El peso muestra centavos solo cuando los hay (p. ej. 1.234,50).
  const hasCents = Math.round(value * 100) % 100 !== 0;
  const digits = hasCents ? 2 : currency.fractionDigits;
  const key = `${currency.code}:${digits}`;
  if (!formats.has(key)) {
    formats.set(
      key,
      new Intl.NumberFormat(currency.locale, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
        useGrouping: 'always',
      }),
    );
  }
  return formats.get(key).format(value);
}

/** COP: 1639.5 -> "$ 1.639,50", 4500000 -> "$ 4.500.000"; USD: 1639.5 -> "US$ 1,639.50" */
export function money(n) {
  const value = Number(n) || 0;
  return (value < 0 ? '-' : '') + currency.prefix + formatNumber(Math.abs(value));
}

/** Monto de un movimiento con signo según su tipo: +$ 10.000 / −$ 10.000 */
export const signedMoney = (amount, type) => (type === 'EXPENSE' ? '−' : '+') + money(Math.abs(amount));

/** Balance con signo explícito: +$ 10.000 / −$ 10.000 */
export const signedBalance = (n) => (n < 0 ? '−' : '+') + money(Math.abs(n));

/** Número corto para ejes de gráficos: 1200 -> "1.2k", 4500000 -> "4.5M" (útil con pesos). */
export function compact(n) {
  const v = Math.abs(Number(n) || 0);
  const short = (unit, suffix) => `${(v / unit).toFixed(v % unit === 0 ? 0 : 1)}${suffix}`;
  if (v >= 1_000_000) return short(1_000_000, 'M');
  if (v >= 1000) return short(1000, 'k');
  return String(Math.round(v));
}

export const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];
export const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const monthLabel = (month, year) => `${MONTHS[month]} ${year}`;

/** "8 nov" */
export function shortDate(ms) {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()].toLowerCase()}`;
}

/** Fecha local "2026-11-08" (para <input type="date"> y CSV). */
export function isoDate(ms) {
  const d = new Date(ms);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2026-11-08" -> timestamp local al mediodía (evita saltos de día por zona horaria). */
export function isoDateToMs(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).getTime();
}

/** Semana del mes (1..5) para agrupar el flujo semanal. */
export const weekOfMonth = (ms) => Math.min(5, Math.floor((new Date(ms).getDate() - 1) / 7) + 1);

/** Cantidad de bloques de 7 días del mes. */
export const weeksInMonth = (month, year) => Math.ceil(new Date(year, month + 1, 0).getDate() / 7);
