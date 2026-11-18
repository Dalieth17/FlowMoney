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
  availableToSpend,
  dailyExpense,
  spentInCategory,
} from '../public/assets/js/domain/selectors.js';

const at = (y, m, d) => Date.UTC(y, m, d, 17);
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
  test('suma dinero en centavos sin residuo binario', () => {
    assert.deepEqual(totals([tx(1, 'INCOME', 0.1), tx(2, 'INCOME', 0.2), tx(3, 'EXPENSE', 0.3)]), {
      income: 0.3,
      expense: 0.3,
      balance: 0,
    });
  });
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
  test('transferencias y ajustes afectan saldos pero no reportes; futuros solo proyectan', () => {
    const now = Date.UTC(2026, 10, 18, 17);
    const list = [
      tx(1, 'EXPENSE', 100, { kind: 'TRANSFER' }),
      tx(2, 'INCOME', 100, { kind: 'TRANSFER', accountId: 2 }),
      tx(3, 'EXPENSE', 2, { kind: 'NORMAL' }),
      tx(4, 'INCOME', 7, { kind: 'ADJUSTMENT' }),
      tx(5, 'INCOME', 999, { date: Date.UTC(2099, 0, 1, 17) }),
    ];
    assert.deepEqual(totals(inMonth(list, 10, 2026)), { income: 0, expense: 2, balance: -2 });
    assert.equal(spentInCategory(inMonth(list, 10, 2026), 1), 2);
    assert.equal(expenseByCategory(inMonth(list, 10, 2026), [{ id: 1 }])[0].value, 2);
    assert.equal(
      weeklyFlow(inMonth(list, 10, 2026), 10, 2026).reduce((n, w) => n + w.expense, 0),
      2,
    );
    assert.equal(dailyExpense(list, 10, 2026).at(-1).cumulative, 2);
    const [a, b] = accountBalances(
      [
        { id: 1, initialBalance: 500 },
        { id: 2, initialBalance: 0 },
      ],
      list,
      now,
    );
    assert.equal(a.balance, 405);
    assert.equal(a.projectedBalance, 1404);
    assert.equal(b.balance, 100);
  });
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

describe('disponible para gastar', () => {
  const budgets = [
    { categoryId: 1, amount: 1000, month: 10, year: 2026 },
    { categoryId: 2, amount: 500, month: 10, year: 2026 },
    { categoryId: 1, amount: 9999, month: 9, year: 2026 },
  ];
  const list = [
    tx(1, 'EXPENSE', 600, { categoryId: 1 }),
    tx(2, 'EXPENSE', 300, { categoryId: 2 }),
    tx(3, 'EXPENSE', 80, { categoryId: 3 }), // sin presupuesto: no cuenta
    tx(4, 'INCOME', 5000, { categoryId: 1 }),
  ];

  test('reparte lo que queda entre los días que faltan, contando hoy', () => {
    const a = availableToSpend(list, budgets, 10, 2026, new Date(2026, 10, 24, 9));
    assert.equal(a.limit, 1500);
    assert.equal(a.spent, 900);
    assert.equal(a.remaining, 600);
    assert.equal(a.daysLeft, 7); // 24 al 30 de noviembre
    assert.ok(Math.abs(a.perDay - 600 / 7) < 1e-9);
    assert.equal(a.aheadOfPace, 900 - 1500 * (24 / 30));
  });

  test('mes pasado: no quedan días; mes futuro: el mes completo', () => {
    const past = availableToSpend(list, budgets, 10, 2026, new Date(2026, 11, 3));
    assert.equal(past.daysLeft, 0);
    assert.equal(past.perDay, 0);
    const future = availableToSpend([], budgets, 10, 2026, new Date(2026, 9, 15));
    assert.equal(future.daysLeft, 30);
    assert.equal(future.perDay, 50);
    assert.equal(future.aheadOfPace, 0);
  });

  test('si se pasó del límite el diario es cero y sin presupuestos devuelve null', () => {
    const over = availableToSpend(
      [tx(1, 'EXPENSE', 2000, { categoryId: 1 })],
      budgets,
      10,
      2026,
      new Date(2026, 10, 10),
    );
    assert.equal(over.remaining, -500);
    assert.equal(over.perDay, 0);
    assert.equal(availableToSpend(list, budgets, 3, 2026), null);
  });

  test('gasto diario y acumulado del mes', () => {
    const days = dailyExpense(
      [
        tx(1, 'EXPENSE', 10, { date: at(2026, 10, 2) }),
        tx(2, 'EXPENSE', 5, { date: at(2026, 10, 2) }),
        tx(3, 'INCOME', 99, { date: at(2026, 10, 3) }),
        tx(4, 'EXPENSE', 20, { date: at(2026, 10, 30) }),
        tx(5, 'EXPENSE', 7, { date: at(2026, 9, 30) }),
      ],
      10,
      2026,
    );
    assert.equal(days.length, 30);
    assert.deepEqual(days[1], { day: 2, expense: 15, cumulative: 15 });
    assert.equal(days[2].expense, 0);
    assert.equal(days[29].cumulative, 35);
  });
});
