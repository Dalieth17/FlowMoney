// format.js — utilidades de formato (moneda, fechas, semanas).
// Todo en español. La moneda es un único punto de cambio.

export const CURRENCY = '$';

/** Formatea un número como moneda: 1639.5 -> "$1,639.50" */
export function money(n) {
  const v = Math.abs(Number(n) || 0);
  const s = v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? '-' : '') + CURRENCY + s;
}

/** Moneda con signo explícito para ingresos/gastos: +$4,200.00 / -$28.90 */
export function signedMoney(n, type) {
  const sign = type === 'EXPENSE' ? '−' : '+';
  const v = Math.abs(Number(n) || 0);
  return sign + CURRENCY + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Número compacto para ejes: 1200 -> "1.2k" */
export function compact(n) {
  const v = Math.abs(Number(n) || 0);
  if (v >= 1000) return (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'k';
  return String(Math.round(v));
}

export const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
export const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const monthLabel = (m, y) => `${MONTHS[m]} ${y}`;

/** Fecha corta: 1731110400000 -> "8 nov" */
export function shortDate(ms) {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()].toLowerCase()}`;
}

/** Fecha larga para detalles: "sábado, 8 de noviembre" */
export function longDate(ms) {
  const d = new Date(ms);
  return `${DOW[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}`;
}

/** Valor para <input type="date"> en zona local: "2026-11-08" */
export function dateInputValue(ms) {
  const d = new Date(ms);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Convierte "2026-11-08" (input date) a timestamp local al mediodía (evita saltos de día por TZ). */
export function dateInputToMs(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).getTime();
}

/** Semana del mes (1..5) para agrupar el flujo semanal. */
export function weekOfMonth(ms) {
  const day = new Date(ms).getDate();
  return Math.min(5, Math.floor((day - 1) / 7) + 1);
}

/** Cantidad de semanas (bloques de 7 días) que tiene el mes. */
export function weeksInMonth(month, year) {
  const days = new Date(year, month + 1, 0).getDate();
  return Math.ceil(days / 7);
}
