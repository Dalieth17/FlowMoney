import { h } from './dom.js';
import { donut, groupedBars } from './charts.js';
import { getChartStyle } from '../core/chartStyle.js';
import { money } from '../core/format.js';

export const barsChart = (data, options = {}) => financialChart('bars', data, options);
export const donutChart = (data, options = {}) => financialChart('donut', data, options);

function financialChart(kind, data, options) {
  const requested = getChartStyle();
  const fallback = h('div', {
    class: 'financial-chart-fallback',
    html: kind === 'donut' ? donut(data, options) : groupedBars(data, options),
  });
  const label = kind === 'donut' ? 'Gastos por categoría' : 'Ingresos y gastos';
  const root = h(
    'div',
    {
      class: `financial-chart ${kind}`,
      role: 'group',
      'aria-label': label,
      dataset: { requestedStyle: requested, renderStyle: '2d' },
    },
    fallback,
  );
  const nonzero = data.some((d) => (kind === 'donut' ? d.value > 0 : d.income > 0 || d.expense > 0));
  if (requested !== '3d' || !nonzero) return root;
  const canvas = h('canvas', { 'aria-hidden': 'true' });
  const labels = h('div', { class: 'financial-labels', 'aria-hidden': 'true' });
  const viewport = h('div', { class: 'financial-viewport', hidden: true }, [
    canvas,
    labels,
    kind === 'donut'
      ? h('div', { class: 'financial-total' }, [
          h('small', {}, 'Gasto total'),
          h('b', { class: 'tnum' }, money(options.total ?? data.reduce((n, d) => n + d.value, 0))),
        ])
      : null,
  ]);
  const turn = (direction) => canvas.dispatchEvent(new CustomEvent('flowmoney:chart-view', { detail: direction }));
  const controls = h('div', { class: 'financial-controls no-print', hidden: true }, [
    h('span', { class: 'field-hint' }, '3D · arrastra para girar'),
    h('div', { class: 'financial-control-buttons' }, [
      h(
        'button',
        {
          type: 'button',
          class: 'icon-btn sm',
          'aria-label': `Girar ${label} a la izquierda`,
          onclick: () => turn(-0.18),
        },
        '←',
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'icon-btn sm',
          'aria-label': `Girar ${label} a la derecha`,
          onclick: () => turn(0.18),
        },
        '→',
      ),
      h('button', { type: 'button', class: 'btn btn-ghost sm', onclick: () => turn('reset') }, 'Restablecer vista'),
    ]),
  ]);
  const notice = h('p', { class: 'field-hint no-print', role: 'status', hidden: true });
  const detail = h('details', { class: 'financial-data' }, [
    h('summary', {}, 'Ver importes del gráfico'),
    h(
      'div',
      { class: 'report-table-wrap' },
      h('table', { class: 'report-table' }, [
        h('caption', {}, label),
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            (kind === 'donut' ? ['Categoría', 'Gasto'] : ['Período', 'Ingresos', 'Gastos']).map((text) =>
              h('th', { scope: 'col' }, text),
            ),
          ),
        ),
        h(
          'tbody',
          {},
          data.map((item) =>
            h('tr', {}, [
              h('th', { scope: 'row' }, item.label),
              ...(kind === 'donut' ? [item.value] : [item.income, item.expense]).map((value) =>
                h('td', { class: 'tnum' }, money(value)),
              ),
            ]),
          ),
        ),
      ]),
    ),
  ]);
  root.append(viewport, controls, notice, detail);
  let lost = false;
  const showFallback = () => {
    lost = true;
    viewport.hidden = true;
    controls.hidden = true;
    fallback.hidden = false;
    root.dataset.renderStyle = '2d';
    notice.textContent = 'Se muestra el gráfico 2D porque la vista 3D no está disponible en este momento.';
    notice.hidden = false;
  };
  canvas.addEventListener('webglcontextlost', showFallback);
  requestAnimationFrame(async () => {
    if (!root.isConnected) return;
    try {
      const { mountFinancialChart } = await import('./three/financialScene.js');
      if (!root.isConnected) return;
      viewport.hidden = false;
      await mountFinancialChart(canvas, { kind, data, labels });
      if (!root.isConnected || lost) return;
      fallback.hidden = true;
      controls.hidden = false;
      root.dataset.renderStyle = '3d';
    } catch {
      if (root.isConnected) showFallback();
    }
  });
  return root;
}
