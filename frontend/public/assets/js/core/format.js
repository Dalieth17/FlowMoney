// Formato de moneda, números y fechas. Funciones puras (salvo la moneda activa).

export const CURRENCIES = Object.freeze([
  { symbol: '$', label: 'Dólar / peso ($)' },
  { symbol: 'S/', label: 'Sol peruano (S/)' },
  { symbol: 'US$', label: 'Dólar estadounidense (US$)' },
  { symbol: '€', label: 'Euro (€)' },
]);

let currency = '$';
export const setCurrency = (symbol) => {
  if (CURRENCIES.some((c) => c.symbol === symbol)) currency = symbol;
};
export const getCurrency = () => currency;

const numberFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// "S/" lleva espacio ("S/ 25.00"); los símbolos tipo "$" van pegados ("$25.00").
const prefix = () => (/[A-Za-z/]$/.test(currency) ? `${currency} ` : currency);

/** 1639.5 -> "$1,639.50"; -20 -> "-$20.00" */
export function money(n) {
  const value = Number(n) || 0;
  return (value < 0 ? '-' : '') + prefix() + numberFormat.format(Math.abs(value));
}

/** Monto de un movimiento con signo según su tipo: +$10.00 / −$10.00 */
export const signedMoney = (amount, type) => (type === 'EXPENSE' ? '−' : '+') + money(Math.abs(amount));

/** Balance con signo explícito: +$10.00 / −$10.00 */
export const signedBalance = (n) => (n < 0 ? '−' : '+') + money(Math.abs(n));

/** Número corto para ejes de gráficos: 1200 -> "1.2k" */
export function compact(n) {
  const v = Math.abs(Number(n) || 0);
  if (v >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
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
