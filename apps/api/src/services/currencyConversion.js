const HttpError = require('../utils/httpError');
const { normalize } = require('./backupService');

/** Aritmética decimal entera: redondeo a centavos, sin acumular errores binarios. */
function converter(from, copPerUsd) {
  const rate = BigInt(Math.round(copPerUsd * 1e6));
  return (amount, positive = false) => {
    const cents = BigInt(Math.round(Math.abs(amount) * 100));
    const numerator = from === 'COP' ? cents * 1000000n : cents * rate;
    const denominator = from === 'COP' ? rate : 1000000n;
    const result = (numerator + denominator / 2n) / denominator;
    if (result > 999999999999n)
      throw HttpError.badRequest('La conversión supera el monto máximo permitido. No se ha cambiado ningún dato.');
    if (positive && result === 0n)
      throw HttpError.badRequest(
        'Un monto quedaría por debajo de 0.01 en la moneda destino. No se ha cambiado ningún dato.',
      );
    return (Number(result) / 100) * (amount < 0 ? -1 : 1);
  };
}

function convertData(original, target, copPerUsd) {
  const data = structuredClone(original);
  const convert = converter(original.currency, copPerUsd);
  data.currency = target;
  for (const a of data.accounts) a.initialBalance = convert(a.initialBalance);
  for (const t of data.transactions) t.amount = convert(t.amount, true);
  for (const b of data.budgets) b.amount = convert(b.amount, true);
  for (const s of data.schedules) s.data.transaction.amount = convert(s.data.transaction.amount, true);
  for (const g of data.goals) g.data.target = convert(g.data.target, true);
  for (const e of data.goalEntries) e.data.amount = convert(e.data.amount, true);
  for (const op of data.operations) {
    const d = op.data;
    if (op.kind === 'TRANSFER') {
      d.amount = convert(d.amount, true);
      d.fee = convert(d.fee, d.fee > 0);
    } else {
      d.expectedBalance = convert(d.expectedBalance);
      d.actualBalance = convert(d.actualBalance);
      // El ajuste debe seguir siendo exactamente observado − esperado tras redondear.
      const leg = data.transactions.find((t) => t.operationId === op.id);
      if (leg) {
        const difference = Math.round(d.actualBalance * 100) - Math.round(d.expectedBalance * 100);
        if (!difference)
          throw HttpError.badRequest('Un ajuste de conciliación quedaría en cero. No se ha cambiado ningún dato.');
        leg.amount = Math.abs(difference) / 100;
        leg.type = difference > 0 ? 'INCOME' : 'EXPENSE';
      }
    }
  }
  // Incluye referencias, transferencias, conciliaciones y saldos de metas de ahorro.
  try {
    return normalize(data);
  } catch {
    throw HttpError.badRequest(
      'El redondeo produciría datos financieros inconsistentes. No se ha cambiado ningún dato.',
    );
  }
}

module.exports = { converter, convertData };
