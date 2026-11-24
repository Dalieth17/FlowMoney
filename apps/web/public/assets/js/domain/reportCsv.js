import { toCsv } from './csv.js';

const period = ({ year, month }) => `${year}-${String(month + 1).padStart(2, '0')}`;

function balances({ income, expense }) {
  return { income, expense, balance: (Math.round(income * 100) - Math.round(expense * 100)) / 100 };
}

/** Exporta el mismo reporte agregado que está viendo la persona. */
export function monthlyReportCsv(report, scope) {
  const rows = [{ section: 'Resumen', ...report.summary }];
  for (const month of report.history) {
    rows.push({ section: 'Histórico', period: period(month), ...balances(month) });
  }
  if (report.comparison) {
    const previous = report.history.at(-2);
    const change = report.comparison.change;
    rows.push({
      section: 'Variación mensual',
      detail: change ? `Frente a ${period(previous)}` : `Sin actividad comparable frente a ${period(previous)}`,
      ...change,
    });
  }
  for (const { category, value } of report.categories) {
    rows.push({ section: 'Gastos por categoría', detail: category.name, expense: value });
  }
  for (const account of report.accounts) {
    rows.push({ section: 'Actividad por cuenta', detail: account.label, ...balances(account) });
  }
  const current = period(report);
  return toCsv(rows, [
    { header: 'Período', value: (row) => row.period ?? current },
    { header: 'Filtro de cuenta', value: () => scope },
    { header: 'Moneda', value: () => report.currency },
    { header: 'Sección', value: (row) => row.section },
    { header: 'Detalle', value: (row) => row.detail },
    { header: 'Ingresos', value: (row) => row.income },
    { header: 'Gastos', value: (row) => row.expense },
    { header: 'Balance', value: (row) => row.balance },
    { header: 'Tasa de ahorro (%)', value: (row) => row.savingRate },
  ]);
}
