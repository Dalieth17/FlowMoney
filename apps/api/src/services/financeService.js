const { withUserTransaction } = require('../db/pool');
const repo = require('../repositories/financeRepository');
const txRepo = require('../repositories/transactionRepository');
const cats = require('../repositories/categoryRepository');
const accounts = require('../repositories/accountRepository');
const history = require('../repositories/historyRepository');
const HttpError = require('../utils/httpError');
const { isDeepStrictEqual } = require('node:util');

const today = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
const at = (day) => Date.parse(`${day}T17:00:00Z`);
const cents = (n) => Math.round(n * 100);
async function refs(userId, categoryId, accountIds, db) {
  if (!(await cats.findOwned(categoryId, userId, db))) throw HttpError.badRequest('Categoría no válida');
  for (const id of accountIds.filter((x) => x != null)) {
    if (!(await accounts.findOwned(id, userId, db))) throw HttpError.badRequest('Cuenta no válida');
  }
}
async function post(userId, data, db) {
  const tx = await txRepo.create(userId, data, db);
  await history.record(userId, tx.id, 'CREATE', null, tx, db);
  return tx;
}
async function erase(userId, operationId, db) {
  const rows = await repo.operationTransactions(userId, operationId, db);
  for (const row of rows) {
    const before = await txRepo.findOwned(row.id, userId, db);
    await history.record(userId, row.id, 'DELETE', before, null, db);
    await txRepo.remove(row.id, userId, db);
  }
}
async function transfer(userId, id, data, editing = false) {
  return withUserTransaction(userId, async (db) => {
    const existing = (await repo.operations(userId, db)).find((o) => o.id === id);
    if (existing && !editing) {
      if (existing.kind !== 'TRANSFER' || !isDeepStrictEqual(existing.data, data))
        throw HttpError.conflict('Esta operación ya existe; recarga antes de reintentar');
      return existing;
    }
    if (editing && (!existing || existing.kind !== 'TRANSFER')) throw HttpError.notFound('Transferencia no encontrada');
    await refs(userId, data.categoryId, [data.fromAccountId, data.toAccountId], db);
    if (existing) await erase(userId, id, db);
    await repo.saveOperation(userId, id, 'TRANSFER', data, db);
    for (const [type, accountId] of [
      ['EXPENSE', data.fromAccountId],
      ['INCOME', data.toAccountId],
    ]) {
      await post(userId, { ...data, type, accountId, kind: 'TRANSFER', operationId: id }, db);
    }
    if (data.fee)
      await post(
        userId,
        {
          ...data,
          amount: data.fee,
          type: 'EXPENSE',
          accountId: data.fromAccountId,
          description: `Comisión: ${data.description}`.slice(0, 120),
          kind: 'NORMAL',
          operationId: id,
        },
        db,
      );
    return { id, kind: 'TRANSFER', data };
  });
}
async function removeTransfer(userId, id) {
  return withUserTransaction(userId, async (db) => {
    const existing = (await repo.operations(userId, db)).find((o) => o.id === id && o.kind === 'TRANSFER');
    if (!existing) throw HttpError.notFound('Transferencia no encontrada');
    await erase(userId, id, db);
    await repo.removeOperation(userId, id, db);
  });
}
async function balances(userId, db) {
  const dayEnd = Date.parse(`${today()}T23:59:59.999-05:00`);
  const accs = await accounts.listByUser(userId, db);
  const txs = await txRepo.listByUser(userId, db);
  const sums = new Map(
    accs.map((a) => [a.id, { current: cents(a.initialBalance), projected: cents(a.initialBalance) }]),
  );
  for (const tx of txs) {
    const sum = sums.get(tx.accountId);
    if (!sum) continue;
    const delta = (tx.type === 'INCOME' ? 1 : -1) * cents(tx.amount);
    sum.projected += delta;
    if (tx.date <= dayEnd) sum.current += delta;
  }
  return accs.map((a) => ({
    ...a,
    currentBalance: sums.get(a.id).current / 100,
    projectedBalance: sums.get(a.id).projected / 100,
  }));
}
async function reconcile(userId, id, data) {
  return withUserTransaction(userId, async (db) => {
    const old = (await repo.operations(userId, db)).find((o) => o.id === id);
    if (old) {
      const original = { ...old.data };
      delete original.date;
      if (old.kind !== 'RECONCILIATION' || !isDeepStrictEqual(original, data))
        throw HttpError.conflict('Identificador ya utilizado');
      return old;
    }
    await refs(userId, data.categoryId, [data.accountId], db);
    const account = (await balances(userId, db)).find((a) => a.id === data.accountId);
    if (cents(account.currentBalance) !== cents(data.expectedBalance))
      throw HttpError.conflict('El saldo cambió. Recarga y vuelve a conciliar');
    const difference = cents(data.actualBalance) - cents(data.expectedBalance);
    if (Math.abs(difference) > 999999999999) throw HttpError.badRequest('Ajuste demasiado grande');
    const saved = { ...data, date: at(today()) };
    await repo.saveOperation(userId, id, 'RECONCILIATION', saved, db);
    if (difference)
      await post(
        userId,
        {
          description: 'Ajuste de conciliación',
          amount: Math.abs(difference) / 100,
          type: difference > 0 ? 'INCOME' : 'EXPENSE',
          categoryId: data.categoryId,
          accountId: data.accountId,
          note: data.note,
          date: saved.date,
          kind: 'ADJUSTMENT',
          operationId: id,
        },
        db,
      );
    return { id, kind: 'RECONCILIATION', data: saved };
  });
}
async function saveSchedule(userId, id, data) {
  return withUserTransaction(userId, async (db) => {
    await refs(userId, data.transaction.categoryId, [data.transaction.accountId], db);
    const schedules = await repo.schedules(userId, db);
    if (id) {
      const old = schedules.find((s) => s.id === id);
      if (!old) throw HttpError.notFound('Recurrencia no encontrada');
      if (old.data.creationKey) {
        if (data.creationKey && data.creationKey !== old.data.creationKey)
          throw HttpError.conflict('No se puede cambiar la clave de creación de una recurrencia');
        data = { ...data, creationKey: old.data.creationKey };
      }
      if (data.creationKey && schedules.some((s) => s.id !== id && s.data.creationKey === data.creationKey))
        throw HttpError.conflict('La clave de creación ya pertenece a otra recurrencia');
      await repo.updateSchedule(userId, id, data, db);
    } else {
      const previous = data.creationKey && schedules.find((s) => s.data.creationKey === data.creationKey);
      if (previous) {
        if (!isDeepStrictEqual(previous.data, data)) throw HttpError.conflict('La solicitud de recurrencia ya existe');
        return previous;
      }
      id = await repo.createSchedule(userId, data, db);
    }
    return { id, data };
  });
}
async function runSchedules(userId, now = new Date()) {
  return withUserTransaction(userId, async (db) => {
    const current = today(now);
    const existing = new Set((await repo.occurrences(userId, db)).map((o) => `${o.scheduleId}:${o.period}`));
    let generated = 0;
    for (const { id, data } of await repo.schedules(userId, db)) {
      if (!data.active) continue;
      const [year, month] = data.startDate.split('-').map(Number);
      for (
        let key = year * 12 + month - 1;
        key <= Number(current.slice(0, 4)) * 12 + Number(current.slice(5, 7)) - 1;
        key++
      ) {
        const y = Math.floor(key / 12),
          m = key % 12;
        const period = `${y}-${String(m + 1).padStart(2, '0')}`;
        const due = `${period}-${String(Math.min(data.dayOfMonth, new Date(Date.UTC(y, m + 1, 0)).getUTCDate())).padStart(2, '0')}`;
        if (
          due < data.startDate ||
          due > current ||
          (data.endDate && due > data.endDate) ||
          existing.has(`${id}:${period}`)
        )
          continue;
        if (generated >= 120) return { generated, more: true };
        await refs(userId, data.transaction.categoryId, [data.transaction.accountId], db);
        const tx = await post(userId, { ...data.transaction, date: at(due) }, db);
        await repo.addOccurrence(id, period, tx.id, db);
        generated++;
      }
    }
    return { generated, more: false };
  });
}
async function state(userId) {
  return withUserTransaction(userId, async (db) => ({
    accounts: await balances(userId, db),
    operations: await repo.operations(userId, db),
    schedules: await repo.schedules(userId, db),
  }));
}
module.exports = { transfer, removeTransfer, reconcile, saveSchedule, runSchedules, state, today, at, balances };
