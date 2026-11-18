const crypto = require('node:crypto');
const { withUserTransaction } = require('../db/pool');
const { z } = require('zod');
const goalSchemas = require('../validation/goalSchemas');
const goalRepo = require('../repositories/goalRepository');
const { today } = require('./financeService');
const schema = require('../validation/financeSchemas').backup.extend({
  version: z.literal(3),
  goals: z.array(z.object({ id: goalSchemas.uuid, data: goalSchemas.goal })).max(1000),
  goalEntries: z
    .array(z.object({ id: goalSchemas.uuid, goalId: goalSchemas.uuid, data: goalSchemas.entry }))
    .max(20000),
});
const accounts = require('../repositories/accountRepository');
const categories = require('../repositories/categoryRepository');
const transactions = require('../repositories/transactionRepository');
const budgets = require('../repositories/budgetRepository');
const finance = require('../repositories/financeRepository');
const users = require('../repositories/userRepository');
const { verifyPassword } = require('../utils/password');
const HttpError = require('../utils/httpError');

function normalize(input) {
  if (
    input?.version === 1 &&
    Array.isArray(input.transactions) &&
    !input.transactions.some((t) => t?.operationId || (t?.kind && t.kind !== 'NORMAL'))
  ) {
    input = { ...input, version: 2, currency: input.user?.currency, operations: [], schedules: [], occurrences: [] };
  }
  if (input?.version === 2) input = { ...input, version: 3, goals: [], goalEntries: [] };
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw HttpError.badRequest(`Respaldo no válido: ${parsed.error.issues[0].path.join('.')}`);
  const data = parsed.data;
  const unique = (items, key = (x) => x.id) => new Set(items.map(key)).size === items.length;
  for (const field of [
    'accounts',
    'categories',
    'transactions',
    'budgets',
    'operations',
    'schedules',
    'goals',
    'goalEntries',
  ]) {
    if (!unique(data[field])) throw HttpError.badRequest(`Identificadores repetidos en ${field}`);
  }
  const goalTotals = new Map(data.goals.map((g) => [g.id, 0n]));
  for (const e of data.goalEntries) {
    if (!goalTotals.has(e.goalId) || e.data.date > today())
      throw HttpError.badRequest('Aporte de ahorro no válido en el respaldo');
    goalTotals.set(
      e.goalId,
      goalTotals.get(e.goalId) + (e.data.type === 'ADD' ? 1n : -1n) * BigInt(Math.round(e.data.amount * 100)),
    );
  }
  if ([...goalTotals.values()].some((n) => n < 0n || n > 999999999999n))
    throw HttpError.badRequest('Saldo de ahorro no válido en el respaldo');
  if (
    !unique(data.budgets, (b) => `${b.categoryId}:${b.year}:${b.month}`) ||
    !unique(data.occurrences, (o) => `${o.scheduleId}:${o.period}`)
  )
    throw HttpError.badRequest('Presupuestos o recurrencias duplicados');
  const byId = Object.fromEntries(
    ['accounts', 'categories', 'transactions', 'operations', 'schedules'].map((field) => [
      field,
      new Map(data[field].map((item) => [item.id, item])),
    ]),
  );
  const has = (field, id) => byId[field].has(id);
  const legsByOperation = new Map();
  const creationKeys = new Set();
  for (const s of data.schedules) {
    if (s.data.creationKey && creationKeys.has(s.data.creationKey))
      throw HttpError.badRequest('Claves de recurrencias duplicadas');
    if (s.data.creationKey) creationKeys.add(s.data.creationKey);
  }
  const refs = (tx) => {
    if (!has('categories', tx.categoryId) || (tx.accountId != null && !has('accounts', tx.accountId)))
      throw HttpError.badRequest('Referencias inválidas en el respaldo');
  };
  for (const tx of data.transactions) {
    refs(tx);
    if (tx.operationId && !has('operations', tx.operationId)) throw HttpError.badRequest('Movimiento sin operación');
    if (tx.kind !== 'NORMAL' && !tx.operationId) throw HttpError.badRequest('Movimiento especial sin operación');
    if (tx.operationId) {
      if (!legsByOperation.has(tx.operationId)) legsByOperation.set(tx.operationId, []);
      legsByOperation.get(tx.operationId).push(tx);
    }
  }
  for (const b of data.budgets) {
    if (!has('categories', b.categoryId)) throw HttpError.badRequest('Categoría de presupuesto ausente');
    if (b.amount <= 0) throw HttpError.badRequest('Monto de presupuesto no válido');
  }
  for (const s of data.schedules) refs(s.data.transaction);
  const assignedTransactions = new Set();
  for (const o of data.occurrences) {
    if (!has('schedules', o.scheduleId) || (o.transactionId != null && !has('transactions', o.transactionId)))
      throw HttpError.badRequest('Ocurrencia inválida');
    if (o.transactionId != null) {
      const tx = byId.transactions.get(o.transactionId);
      if (assignedTransactions.has(tx.id) || tx.kind !== 'NORMAL' || tx.operationId)
        throw HttpError.badRequest('Ocurrencia repetida o asociada a una operación especial');
      assignedTransactions.add(tx.id);
    }
  }
  const equalMoney = (a, b) => Math.round(a * 100) === Math.round(b * 100);
  for (const op of data.operations) {
    const d = op.data;
    refs({ categoryId: d.categoryId, accountId: op.kind === 'TRANSFER' ? d.fromAccountId : d.accountId });
    const legs = legsByOperation.get(op.id) || [];
    if (op.kind === 'TRANSFER') {
      if (!has('accounts', d.toAccountId) || legs.length !== (d.fee ? 3 : 2))
        throw HttpError.badRequest('Transferencia incompleta');
      for (const [type, accountId, amount, kind] of [
        ['INCOME', d.toAccountId, d.amount, 'TRANSFER'],
        ['EXPENSE', d.fromAccountId, d.amount, 'TRANSFER'],
        ...(d.fee ? [['EXPENSE', d.fromAccountId, d.fee, 'NORMAL']] : []),
      ])
        if (
          !legs.some(
            (t) =>
              t.type === type &&
              t.accountId === accountId &&
              equalMoney(t.amount, amount) &&
              t.kind === kind &&
              t.date === d.date &&
              t.categoryId === d.categoryId,
          )
        )
          throw HttpError.badRequest('Transferencia inconsistente');
    } else {
      const difference = Math.round((d.actualBalance - d.expectedBalance) * 100);
      if (
        legs.length !== (difference ? 1 : 0) ||
        (difference &&
          !legs.some(
            (t) =>
              t.kind === 'ADJUSTMENT' &&
              t.accountId === d.accountId &&
              t.date === d.date &&
              t.type === (difference > 0 ? 'INCOME' : 'EXPENSE') &&
              equalMoney(t.amount, Math.abs(difference) / 100),
          ))
      )
        throw HttpError.badRequest('Conciliación inconsistente');
    }
  }
  return data;
}
const digest = (data) => crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
function preview(input) {
  const data = normalize(input);
  return {
    digest: digest(data),
    currency: data.currency,
    accounts: data.accounts.length,
    categories: data.categories.length,
    transactions: data.transactions.length,
    budgets: data.budgets.length,
    operations: data.operations.length,
    schedules: data.schedules.length,
    goals: data.goals.length,
    goalEntries: data.goalEntries.length,
  };
}
async function exportData(userId) {
  const data = await withUserTransaction(userId, async (db) => ({
    version: 3,
    currency: (await users.findById(userId, db)).currency,
    accounts: await accounts.listByUser(userId, db),
    categories: await categories.listByUser(userId, db),
    transactions: await transactions.listByUser(userId, db),
    budgets: await budgets.listByUser(userId, db),
    operations: await finance.operations(userId, db),
    schedules: await finance.schedules(userId, db),
    occurrences: await finance.occurrences(userId, db),
    ...(await goalRepo.list(userId, db)),
  }));
  normalize(data);
  if (Buffer.byteLength(JSON.stringify(data), 'utf8') > 20 * 1024 * 1024)
    throw HttpError.badRequest('El respaldo supera 20 MB; utiliza una copia de MySQL');
  return data;
}
async function clear(userId, db) {
  await goalRepo.clear(userId, db);
  await finance.clearSchedules(userId, db);
  await transactions.removeAllByUser(userId, db);
  await finance.clearOperations(userId, db);
  await budgets.removeAllByUser(userId, db);
  await categories.removeAllByUser(userId, db);
  await accounts.removeAllByUser(userId, db);
}
async function restore(userId, input, confirmation, password) {
  const data = normalize(input);
  if (confirmation !== digest(data)) throw HttpError.badRequest('Vuelve a revisar la vista previa del respaldo');
  return withUserTransaction(userId, async (db) => {
    const hash = await users.findPasswordHash(userId, db);
    if (!(await verifyPassword(password, hash)).valid) throw HttpError.badRequest('La contraseña no es correcta');
    await clear(userId, db);
    const accMap = new Map(),
      catMap = new Map(),
      txMap = new Map(),
      scheduleMap = new Map();
    for (const a of data.accounts) accMap.set(a.id, (await accounts.create(userId, a, db)).id);
    for (const c of data.categories) catMap.set(c.id, (await categories.create(userId, c, db)).id);
    for (const t of data.transactions)
      txMap.set(
        t.id,
        (
          await transactions.create(
            userId,
            {
              ...t,
              categoryId: catMap.get(t.categoryId),
              accountId: t.accountId == null ? null : accMap.get(t.accountId),
            },
            db,
          )
        ).id,
      );
    for (const b of data.budgets) await budgets.upsert(userId, { ...b, categoryId: catMap.get(b.categoryId) }, db);
    for (const o of data.operations) {
      const d = { ...o.data, categoryId: catMap.get(o.data.categoryId) };
      if (o.kind === 'TRANSFER') {
        d.fromAccountId = accMap.get(d.fromAccountId);
        d.toAccountId = accMap.get(d.toAccountId);
      } else d.accountId = accMap.get(d.accountId);
      await finance.saveOperation(userId, o.id, o.kind, d, db);
    }
    for (const s of data.schedules) {
      const t = s.data.transaction;
      const d = {
        ...s.data,
        transaction: {
          ...t,
          categoryId: catMap.get(t.categoryId),
          accountId: t.accountId == null ? null : accMap.get(t.accountId),
        },
      };
      scheduleMap.set(s.id, await finance.createSchedule(userId, d, db));
    }
    for (const o of data.occurrences)
      await finance.addOccurrence(
        scheduleMap.get(o.scheduleId),
        o.period,
        o.transactionId == null ? null : txMap.get(o.transactionId),
        db,
      );
    const user = await users.findById(userId, db);
    for (const g of data.goals) await goalRepo.save(userId, g.id, g.data, db);
    for (const e of data.goalEntries) await goalRepo.add(userId, e.id, e.goalId, e.data, db);
    await users.updateProfile(userId, { name: user.name, currency: data.currency }, db);
    return { restored: true, transactions: data.transactions.length };
  });
}
module.exports = { exportData, preview, restore, clear, normalize };
