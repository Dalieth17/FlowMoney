const { withUserTransaction } = require('../db/pool');
const repo = require('../repositories/goalRepository');
const { isDeepStrictEqual } = require('node:util');
const { today } = require('./financeService');
const HttpError = require('../utils/httpError');
const cents = (n) => Math.round(n * 100);
const total = (entries) =>
  entries.reduce((n, e) => n + (e.data.type === 'ADD' ? 1n : -1n) * BigInt(cents(e.data.amount)), 0n);
function validBalance(entries) {
  const sum = total(entries);
  if (sum < 0n || sum > 999999999999n) throw HttpError.conflict('El ahorro debe quedar entre 0 y 9.999.999.999,99');
  return Number(sum);
}
const list = (userId) => withUserTransaction(userId, (db) => repo.list(userId, db));
function save(userId, id, data, editing = false) {
  return withUserTransaction(userId, async (db) => {
    const { goals } = await repo.list(userId, db);
    const existing = goals.find((g) => g.id === id);
    if (editing && !existing) throw HttpError.notFound('Meta no encontrada');
    if (!editing && existing) {
      if (!isDeepStrictEqual(existing.data, data)) throw HttpError.conflict('Esta solicitud ya creó otra meta');
      return existing;
    }
    await repo.save(userId, id, data, db);
    return { id, data };
  });
}
function add(userId, id, entryId, data) {
  return withUserTransaction(userId, async (db) => {
    const { goals, goalEntries } = await repo.list(userId, db);
    const goal = goals.find((g) => g.id === id);
    if (!goal) throw HttpError.notFound('Meta no encontrada');
    const existing = goalEntries.find((e) => e.id === entryId);
    if (existing) {
      if (existing.goalId !== id || !isDeepStrictEqual(existing.data, data))
        throw HttpError.conflict('Identificador de aporte ya utilizado');
      return existing;
    }
    if (goal.data.archived) throw HttpError.conflict('Reactiva la meta antes de registrar aportes');
    if (data.date > today()) throw HttpError.badRequest('No se registran aportes futuros como dinero ahorrado');
    validBalance([...goalEntries.filter((e) => e.goalId === id), { data }]);
    await repo.add(userId, entryId, id, data, db);
    return { id: entryId, goalId: id, data };
  });
}
function removeEntry(userId, id, entryId) {
  return withUserTransaction(userId, async (db) => {
    const { goalEntries } = await repo.list(userId, db);
    if (!goalEntries.some((e) => e.id === entryId && e.goalId === id)) throw HttpError.notFound('Aporte no encontrado');
    validBalance(goalEntries.filter((e) => e.goalId === id && e.id !== entryId));
    await repo.removeEntry(userId, entryId, db);
  });
}
module.exports = { list, save, add, removeEntry, total, validBalance };
