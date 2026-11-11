import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  inMonth,
  totals,
  savingRate,
  budgetStatus,
  accountBalances,
  filterTransactions,
  weeklyFlow,
  expenseByCategory,
  monthlySeries,
} from '../public/assets/js/domain/selectors.js';

const at = (y, m, d) => new Date(y, m, d, 12).getTime();
const tx = (id, type, amount, extra = {}) => ({
  id,
  type,
  amount,
  date: at(2026, 10, 5),
  categoryId: 1,
  accountId: 1,
  description: `mov ${id}`,
  note: '',
  ...extra,
});

describe('totales', () => {
  test('suma ingresos, gastos y balance', () => {
    const t = totals([tx(1, 'INCOME', 1000), tx(2, 'EXPENSE', 250.5), tx(3, 'EXPENSE', 49.5)]);
    assert.deepEqual(t, { income: 1000, expense: 300, balance: 700 });
    assert.equal(savingRate(t), 70);
  });

  test('tasa de ahorro sin ingresos es 0', () => {
    assert.equal(savingRate(totals([tx(1, 'EXPENSE', 10)])), 0);
  });
});

describe('inMonth', () => {
  test('filtra por mes y ordena del más reciente al más antiguo', () => {
    const list = [
      tx(1, 'EXPENSE', 1, { date: at(2026, 10, 3) }),
      tx(2, 'EXPENSE', 1, { date: at(2026, 9, 30) }),
      tx(3, 'EXPENSE', 1, { date: at(2026, 10, 20) }),
    ];
    assert.deepEqual(
      inMonth(list, 10, 2026).map((t) => t.id),
      [3, 1],
    );
  });
});

describe('budgetStatus', () => {
  test('umbrales: <80% ok, >=80% aviso, >=100% superado', () => {
    assert.equal(budgetStatus(79, 100).level, 'ok');
    assert.equal(budgetStatus(80, 100).level, 'warn');
    assert.equal(budgetStatus(100, 100).level, 'over');
    assert.equal(budgetStatus(10, 0), null);
  });
});

describe('accountBalances', () => {
  test('saldo = saldo inicial + ingresos − gastos de esa cuenta', () => {
    const accounts = [
      { id: 1, name: 'Banco', type: 'BANK', initialBalance: 500 },
      { id: 2, name: 'Efectivo', type: 'CASH', initialBalance: 0 },
    ];
    const list = [tx(1, 'INCOME', 1000), tx(2, 'EXPENSE', 200), tx(3, 'EXPENSE', 30, { accountId: 2 })];
    const [bank, cash] = accountBalances(accounts, list);
    assert.equal(bank.balance, 1300);
    assert.equal(bank.count, 2);
    assert.equal(cash.balance, -30);
  });
});

describe('filterTransactions', () => {
  const list = [
    tx(1, 'EXPENSE', 10, { description: 'Starbucks', categoryId: 1 }),
    tx(2, 'INCOME', 99, { description: 'Sueldo', categoryId: 8, accountId: 2 }),
    tx(3, 'EXPENSE', 5, { description: 'Taxi', note: 'al aeropuerto', categoryId: 2 }),
  ];
  const ids = (f) => filterTransactions(list, f).map((t) => t.id);

  test('sin filtros devuelve todo', () => assert.deepEqual(ids(), [1, 2, 3]));
  test('por tipo', () => assert.deepEqual(ids({ type: 'INCOME' }), [2]));
  test('por categoría (acepta string del <select>)', () => assert.deepEqual(ids({ categoryId: '2' }), [3]));
  test('por cuenta', () => assert.deepEqual(ids({ accountId: '2' }), [2]));
  test('busca en descripción y nota, sin distinguir mayúsculas', () => {
    assert.deepEqual(ids({ query: 'STAR' }), [1]);
    assert.deepEqual(ids({ query: 'aeropuerto' }), [3]);
  });
});

describe('agrupaciones', () => {
  test('flujo semanal agrupa por bloques de 7 días', () => {
    const list = [
      tx(1, 'INCOME', 100, { date: at(2026, 10, 1) }),
      tx(2, 'EXPENSE', 40, { date: at(2026, 10, 9) }),
      tx(3, 'EXPENSE', 60, { date: at(2026, 10, 30) }),
    ];
    const weeks = weeklyFlow(list, 10, 2026);
    assert.equal(weeks.length, 5);
    assert.equal(weeks[0].income, 100);
    assert.equal(weeks[1].expense, 40);
    assert.equal(weeks[4].expense, 60);
  });

  test('gasto por categoría ordenado de mayor a menor', () => {
    const categories = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ];
    const list = [tx(1, 'EXPENSE', 10), tx(2, 'EXPENSE', 30, { categoryId: 2 }), tx(3, 'INCOME', 999)];
    assert.deepEqual(
      expenseByCategory(list, categories).map((x) => [x.category.name, x.value]),
      [
        ['B', 30],
        ['A', 10],
      ],
    );
  });

  test('serie mensual cruza el cambio de año', () => {
    const list = [tx(1, 'INCOME', 10, { date: at(2025, 11, 15) }), tx(2, 'EXPENSE', 4, { date: at(2026, 0, 15) })];
    const series = monthlySeries(list, 0, 2026, 2, (m) => String(m));
    assert.deepEqual(series, [
      { label: '11', income: 10, expense: 0 },
      { label: '0', income: 0, expense: 4 },
    ]);
  });
});
