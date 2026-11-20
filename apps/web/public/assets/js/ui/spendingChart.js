import { h } from './dom.js';
import { dailyBars } from './charts.js';
import { emptyState } from './widgets.js';
import { spendingChart } from '../domain/spendingChart.js';
import { money, monthLabel } from '../core/format.js';
import { webglAvailable } from './three/scene3d.js';
import { mountColumns } from './three/columnsScene.js';
import { getChartStyle } from '../core/chartStyle.js';

export function spendingChartCard(transactions, month, year, today) {
  const data = spendingChart(transactions, month, year, today);
  const card = h('section', { class: 'panel chart3d' }, [
    h('div', { class: 'panel-head' }, [
      h('div', {}, [
        h('h3', {}, 'Gastos por día'),
        h('span', { class: 'sub' }, `${monthLabel(month, year)} · importes registrados`),
      ]),
      h('div', { class: 'legend' }, [
        h('span', {}, [h('i', { class: 'lg-spent' }), 'Gastado']),
        data.scheduled > 0 ? h('span', {}, [h('i', { class: 'lg-proj' }), 'Programado']) : null,
      ]),
    ]),
  ]);
  if (!data.total) {
    card.append(emptyState('Sin gastos este mes', 'Registra un gasto para ver su importe en el día correspondiente.'));
    return card;
  }
  const fallback = h('div', { class: 'daily-chart-fallback', html: dailyBars(data) });
  const canvas = h('canvas', { class: 'scene', style: { visibility: 'hidden' }, 'aria-hidden': 'true' });
  const labels = h('div', { class: 'scene-labels', hidden: true, 'aria-hidden': 'true' });
  const box = h(
    'div',
    {
      class: 'scene-box daily-scene',
      role: 'img',
      'aria-label': `Gastos de ${monthLabel(month, year)}. Total registrado: ${money(data.total)}. Gastado: ${money(data.spent)}. Programado: ${money(data.scheduled)}.`,
    },
    [canvas, labels, fallback],
  );
  const showFallback = () => {
    canvas.style.visibility = 'hidden';
    labels.hidden = true;
    fallback.hidden = false;
  };
  canvas.addEventListener('webglcontextlost', showFallback);
  card.append(
    h(
      'div',
      {
        class: 'daily-chart-viewport',
        tabindex: '0',
        'aria-label': 'Gráfico diario; desliza horizontalmente si es necesario',
      },
      box,
    ),
    h('p', { class: 'daily-chart-summary tnum' }, [
      `Gastado: ${money(data.spent)}`,
      data.scheduled > 0 ? ` · Programado: ${money(data.scheduled)} · Total registrado: ${money(data.total)}` : '',
    ]),
    h(
      'p',
      { class: 'field-hint' },
      data.scheduled > 0
        ? 'Las columnas delineadas son gastos que registraste para fechas futuras. Los días sin gastos no tienen columna.'
        : 'Cada columna muestra el gasto de ese día. Los días sin gastos no tienen columna.',
    ),
    h('details', { class: 'daily-chart-data' }, [
      h('summary', {}, 'Ver importes por día'),
      h('table', {}, [
        h('caption', {}, `Gastos registrados de ${monthLabel(month, year)}`),
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            ['Día', 'Gasto', 'Acumulado', 'Estado'].map((s) => h('th', { scope: 'col' }, s)),
          ),
        ),
        h(
          'tbody',
          {},
          data.days.map((d) =>
            h('tr', { dataset: { day: d.day } }, [
              h('th', { scope: 'row' }, d.label),
              h('td', { class: 'tnum' }, money(d.expense)),
              h('td', { class: 'tnum' }, money(d.cumulative)),
              h('td', {}, d.expense ? (d.scheduled ? 'Programado' : 'Gastado') : 'Sin movimientos'),
            ]),
          ),
        ),
      ]),
    ]),
  );
  // El SVG permanece visible mientras carga Three.js y también ante errores de GPU/red.
  if (getChartStyle() === '3d' && webglAvailable())
    requestAnimationFrame(async () => {
      if (!canvas.isConnected) return;
      try {
        await mountColumns(canvas, { ...data, labels });
        if (!canvas.isConnected) return;
        canvas.style.visibility = 'visible';
        labels.hidden = false;
        fallback.hidden = true;
      } catch {
        showFallback();
      }
    });
  return card;
}
