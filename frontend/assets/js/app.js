// app.js — controlador de la app web FlowMoney.
// Router simple + 5 vistas (Resumen, Movimientos, Categorías, Presupuestos, Reportes)
// y formularios con sugerencia de IA. Todo se recalcula desde el Store (localStorage).

import { store } from './data.js';
import { classify, confidenceLabel } from './ai.js';
import { donut, groupedBars } from './charts.js';
import { h, clear, openModal, closeModal, toast, confirmDialog, EMOJIS, COLORS } from './ui.js';
import {
  money, signedMoney, MONTHS_SHORT, monthLabel, shortDate, longDate,
  dateInputValue, dateInputToMs, weekOfMonth, weeksInMonth,
} from './format.js';

// ---------- Estado de navegación ----------
const now = new Date();
const state = { view: 'resumen', month: now.getMonth(), year: now.getFullYear() };

// ---------- Selectores / cálculos ----------
const inMonth = (m, y) => store.transactions
  .filter((t) => { const d = new Date(t.date); return d.getMonth() === m && d.getFullYear() === y; })
  .sort((a, b) => b.date - a.date);

function totals(list) {
  const income = list.filter((t) => t.type === 'INCOME').reduce((a, t) => a + t.amount, 0);
  const expense = list.filter((t) => t.type === 'EXPENSE').reduce((a, t) => a + t.amount, 0);
  return { income, expense, balance: income - expense };
}

function expenseByCategory(list) {
  const map = new Map();
  list.filter((t) => t.type === 'EXPENSE').forEach((t) => map.set(t.categoryId, (map.get(t.categoryId) || 0) + t.amount));
  return [...map.entries()]
    .map(([categoryId, value]) => ({ category: store.category(categoryId), value }))
    .filter((x) => x.category)
    .sort((a, b) => b.value - a.value);
}

function weekly(list, m, y) {
  const n = weeksInMonth(m, y);
  const weeks = Array.from({ length: n }, (_, i) => ({ label: `Sem ${i + 1}`, income: 0, expense: 0 }));
  list.forEach((t) => {
    const w = weekOfMonth(t.date) - 1;
    if (weeks[w]) weeks[w][t.type === 'INCOME' ? 'income' : 'expense'] += t.amount;
  });
  return weeks;
}

function budgetState(spent, budget) {
  if (!budget) return null;
  const pct = budget > 0 ? (spent / budget) * 100 : 0;
  if (pct >= 100) return { pct, level: 'over', label: 'Presupuesto superado' };
  if (pct >= 80) return { pct, level: 'warn', label: 'Cerca del límite' };
  return { pct, level: 'ok', label: 'En control' };
}

// ---------- Helpers de formulario ----------
const field = (label, input, hint) => h('label', { class: 'field' }, [
  h('span', { class: 'field-label' }, label),
  input,
  hint ? h('span', { class: 'field-hint' }, hint) : null,
]);

function categoryOption(c, selectedId) {
  return h('option', { value: c.id, selected: c.id === selectedId }, `${c.icon}  ${c.name}`);
}

// =====================================================================
//  FORMULARIO DE MOVIMIENTO (crear / editar) con sugerencia de IA
// =====================================================================
function movementForm(existing) {
  const editing = !!existing;
  let type = existing?.type || 'EXPENSE';
  let catTouched = editing; // si edita, no pisamos su categoría con la IA

  const descInput = h('input', { class: 'input', type: 'text', placeholder: 'Ej. Starbucks, Uber, Sueldo…', value: existing?.description || '', maxlength: 60 });
  const amountInput = h('input', { class: 'input', type: 'number', step: '0.01', min: '0.01', placeholder: '0.00', value: existing ? existing.amount : '' });
  const catSelect = h('select', { class: 'input' }, store.categories.map((c) => categoryOption(c, existing?.categoryId)));
  const accSelect = h('select', { class: 'input' }, store.accounts.map((a) => h('option', { value: a.id, selected: a.id === (existing?.accountId || 1) }, a.name)));
  const dateInput = h('input', { class: 'input', type: 'date', value: dateInputValue(existing?.date || Date.now()) });
  const noteInput = h('textarea', { class: 'input', rows: '2', placeholder: 'Opcional', maxlength: 140 }, existing?.note || '');
  const suggestBox = h('div', { class: 'suggest-box', 'aria-live': 'polite' });

  catSelect.addEventListener('change', () => { catTouched = true; });

  // Toggle tipo
  const typeBtn = (val, label, cls) => h('button', {
    type: 'button', class: 'seg' + (type === val ? ' active ' + cls : ''),
    onclick: () => {
      type = val;
      seg.querySelectorAll('.seg').forEach((b) => b.classList.remove('active', 'in', 'out'));
      typeBtns[val].classList.add('active', val === 'INCOME' ? 'in' : 'out');
      runAI();
    },
  }, label);
  const typeBtns = { INCOME: typeBtn('INCOME', 'Ingreso', 'in'), EXPENSE: typeBtn('EXPENSE', 'Gasto', 'out') };
  const seg = h('div', { class: 'segmented' }, [typeBtns.INCOME, typeBtns.EXPENSE]);

  // IA
  let timer;
  function runAI() {
    clear(suggestBox);
    const s = classify(descInput.value, type);
    if (!s) return;
    const cat = store.categories.find((c) => c.name === s.name);
    if (!cat) return;
    if (!catTouched) catSelect.value = String(cat.id); // autocompleta si el usuario no eligió
    const chip = h('button', {
      type: 'button', class: 'sugg-chip',
      onclick: () => { catSelect.value = String(cat.id); catTouched = true; toast(`Categoría: ${cat.name}`); },
      title: 'Usar esta categoría',
    }, [h('span', { class: 'ic', style: { background: cat.color } }, cat.icon), cat.name]);
    suggestBox.append(
      h('span', { class: 'sugg-lead' }, 'Sugerencia de la IA'),
      chip,
      h('span', { class: 'sugg-conf' }, `confianza ${confidenceLabel(s.confidence)} · ${Math.round(s.confidence * 100)}%`),
    );
  }
  descInput.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(runAI, 180); });

  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() }, [
    field('Tipo', seg),
    field('Descripción', descInput, 'La IA sugiere la categoría a partir de lo que escribas.'),
    suggestBox,
    h('div', { class: 'form-row' }, [
      field('Monto', amountInput),
      field('Fecha', dateInput),
    ]),
    h('div', { class: 'form-row' }, [
      field('Categoría', catSelect),
      field('Cuenta', accSelect),
    ]),
    field('Nota', noteInput),
    h('div', { class: 'modal-actions' }, [
      editing ? h('button', { type: 'button', class: 'btn btn-danger ghost-danger', onclick: async () => {
        if (await confirmDialog(`¿Eliminar "${existing.description}"?`)) { store.deleteTransaction(existing.id); closeModal(); toast('Movimiento eliminado'); }
      } }, 'Eliminar') : h('span'),
      h('div', { class: 'spacer' }),
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: closeModal }, 'Cancelar'),
      h('button', { type: 'submit', class: 'btn btn-primary' }, editing ? 'Guardar cambios' : 'Guardar'),
    ]),
  ]);

  form.addEventListener('submit', () => {
    const amount = parseFloat(amountInput.value);
    if (!descInput.value.trim()) return toast('Escribe una descripción', 'warn');
    if (!(amount > 0)) return toast('El monto debe ser mayor a 0', 'warn');
    const payload = {
      description: descInput.value.trim(),
      amount: Math.round(amount * 100) / 100,
      type,
      categoryId: Number(catSelect.value),
      accountId: Number(accSelect.value),
      date: dateInputToMs(dateInput.value),
      note: noteInput.value.trim(),
    };
    if (editing) { store.updateTransaction(existing.id, payload); toast('Cambios guardados'); }
    else { store.addTransaction(payload); toast('Movimiento registrado'); }
    closeModal();
  });

  if (type === 'INCOME') typeBtns.INCOME.classList.add('active', 'in');
  else typeBtns.EXPENSE.classList.add('active', 'out');

  openModal(editing ? 'Editar movimiento' : 'Nuevo movimiento', form);
  if (descInput.value) runAI();
}

// =====================================================================
//  FORMULARIO DE CATEGORÍA
// =====================================================================
function categoryForm(existing) {
  const editing = !!existing;
  let icon = existing?.icon || EMOJIS[0];
  let color = existing?.color || COLORS[0];
  const nameInput = h('input', { class: 'input', type: 'text', value: existing?.name || '', placeholder: 'Ej. Mascotas', maxlength: 24 });

  const emojiGrid = h('div', { class: 'picker emoji' }, EMOJIS.map((e) => {
    const b = h('button', { type: 'button', class: 'swatch emoji' + (e === icon ? ' sel' : ''), onclick: () => {
      icon = e; emojiGrid.querySelectorAll('.swatch').forEach((x) => x.classList.remove('sel')); b.classList.add('sel');
    } }, e);
    return b;
  }));
  const colorGrid = h('div', { class: 'picker color' }, COLORS.map((c) => {
    const b = h('button', { type: 'button', class: 'swatch color' + (c === color ? ' sel' : ''), style: { background: c }, 'aria-label': c, onclick: () => {
      color = c; colorGrid.querySelectorAll('.swatch.color').forEach((x) => x.classList.remove('sel')); b.classList.add('sel');
    } });
    return b;
  }));

  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() }, [
    field('Nombre', nameInput),
    field('Ícono', emojiGrid),
    field('Color', colorGrid),
    h('div', { class: 'modal-actions' }, [
      h('div', { class: 'spacer' }),
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: closeModal }, 'Cancelar'),
      h('button', { type: 'submit', class: 'btn btn-primary' }, editing ? 'Guardar' : 'Crear categoría'),
    ]),
  ]);
  form.addEventListener('submit', () => {
    if (!nameInput.value.trim()) return toast('Ponle un nombre', 'warn');
    if (editing) { store.updateCategory(existing.id, { name: nameInput.value.trim(), icon, color }); toast('Categoría actualizada'); }
    else { store.addCategory({ name: nameInput.value.trim(), icon, color }); toast('Categoría creada'); }
    closeModal();
  });
  openModal(editing ? 'Editar categoría' : 'Nueva categoría', form);
}

// =====================================================================
//  VISTAS
// =====================================================================
function renderResumen(root) {
  const list = inMonth(state.month, state.year);
  const t = totals(list);
  const cats = expenseByCategory(list);
  const maxCat = Math.max(1, ...cats.map((c) => c.value));
  const wk = weekly(list, state.month, state.year);

  // tarjetas de totales
  const stats = h('div', { class: 'stat-grid' }, [
    statCard('Ingresos', money(t.income), 'var(--pine)'),
    statCard('Gastos', money(t.expense), 'var(--clay)'),
    statCard('Balance', (t.balance >= 0 ? '+' : '−') + money(Math.abs(t.balance)).replace('-', ''), 'var(--brass)', true),
  ]);

  // flujo semanal
  const flow = card('Flujo semanal', 'ingresos vs. gastos', h('div', { class: 'chart-pad', html: groupedBars(wk, { width: 560, height: 220 }) }));

  // categorías
  const catList = cats.length ? h('ul', { class: 'cat-bars' }, cats.map((c) => h('li', {}, [
    h('span', { class: 'ic', style: { background: c.category.color } }, c.category.icon),
    h('div', { class: 'cb-meta' }, [
      h('div', { class: 'cb-top' }, [h('span', { class: 'nm' }, c.category.name), h('span', { class: 'amt tnum' }, money(c.value))]),
      h('div', { class: 'track' }, [h('div', { class: 'fill', style: { width: (c.value / maxCat * 100) + '%', background: c.category.color } })]),
    ]),
  ]))) : emptyState('Sin gastos este mes', 'Registra tu primer movimiento para ver aquí el desglose.');
  const catCard = card('Gasto por categoría', monthLabel(state.month, state.year), catList);

  // presupuestos (resumen)
  const budgetCard = card('Presupuestos', 'alertas del mes', budgetMini());

  // movimientos recientes
  const recent = list.slice(0, 6);
  const recentCard = card('Movimientos recientes', `${list.length} este mes`,
    recent.length ? h('ul', { class: 'mv-list' }, recent.map(mvRow)) : emptyState('Todo tranquilo', 'Aún no hay movimientos en este mes.'),
    h('button', { class: 'link-btn', onclick: () => go('movimientos') }, 'Ver todos'));

  clear(root);
  root.append(
    stats,
    h('div', { class: 'grid-2' }, [flow, catCard]),
    h('div', { class: 'grid-2' }, [budgetCard, recentCard]),
  );
}

function budgetMini() {
  const list = inMonth(state.month, state.year);
  const budgets = store.budgets.filter((b) => b.month === state.month && b.year === state.year);
  if (!budgets.length) return emptyState('Sin presupuestos', 'Define límites por categoría para recibir alertas.',
    h('button', { class: 'btn btn-ghost sm', onclick: () => go('presupuestos') }, 'Crear presupuesto'));
  const spentBy = (id) => list.filter((t) => t.type === 'EXPENSE' && t.categoryId === id).reduce((a, t) => a + t.amount, 0);
  return h('div', { class: 'bud-list' }, budgets
    .map((b) => ({ b, cat: store.category(b.categoryId), spent: spentBy(b.categoryId) }))
    .sort((a, z) => (z.spent / z.b.amount) - (a.spent / a.b.amount))
    .slice(0, 4)
    .map(({ b, cat, spent }) => budgetBar(cat, spent, b.amount)));
}

function budgetBar(cat, spent, budget) {
  const st = budgetState(spent, budget);
  const w = Math.min(100, st.pct);
  const fill = st.level === 'over' ? 'linear-gradient(90deg,var(--brass),var(--clay))'
    : st.level === 'warn' ? 'linear-gradient(90deg,var(--sage),var(--brass))' : 'var(--sage)';
  return h('div', { class: 'bud' }, [
    h('div', { class: 'bud-top' }, [
      h('span', { class: 'nm' }, [h('span', { class: 'dotc', style: { background: cat.color } }), cat.name]),
      h('span', { class: 'fig tnum' }, [h('b', {}, money(spent)), ' de ', money(budget)]),
    ]),
    h('div', { class: 'meter' }, [
      h('div', { class: 'lvl', style: { width: w + '%', background: fill } }),
      h('div', { class: 'mark', style: { left: '80%' } }),
    ]),
    h('div', { class: 'bud-foot' }, [
      h('span', { class: 'flag ' + st.level }, [h('span', { class: 'd' }), st.label]),
      h('span', { class: 'pct tnum' }, Math.round(st.pct) + '%'),
    ]),
  ]);
}

function renderMovimientos(root) {
  const filters = { type: 'ALL', categoryId: 'ALL' };
  const container = h('div');

  function draw() {
    let list = inMonth(state.month, state.year);
    if (filters.type !== 'ALL') list = list.filter((t) => t.type === filters.type);
    if (filters.categoryId !== 'ALL') list = list.filter((t) => t.categoryId === Number(filters.categoryId));

    const typeSel = h('select', { class: 'input slim', onchange: (e) => { filters.type = e.target.value; draw(); } }, [
      h('option', { value: 'ALL', selected: filters.type === 'ALL' }, 'Todos los tipos'),
      h('option', { value: 'INCOME', selected: filters.type === 'INCOME' }, 'Ingresos'),
      h('option', { value: 'EXPENSE', selected: filters.type === 'EXPENSE' }, 'Gastos'),
    ]);
    const catSel = h('select', { class: 'input slim', onchange: (e) => { filters.categoryId = e.target.value; draw(); } }, [
      h('option', { value: 'ALL', selected: filters.categoryId === 'ALL' }, 'Todas las categorías'),
      ...store.categories.map((c) => h('option', { value: c.id, selected: String(c.id) === String(filters.categoryId) }, `${c.icon}  ${c.name}`)),
    ]);
    const t = totals(list);

    clear(container);
    container.append(
      h('div', { class: 'toolbar' }, [
        h('div', { class: 'filters' }, [typeSel, catSel]),
        h('div', { class: 'toolbar-sum tnum' }, [
          h('span', { class: 'in' }, '+' + money(t.income)), h('span', { class: 'out' }, '−' + money(t.expense)),
        ]),
      ]),
      list.length
        ? h('ul', { class: 'mv-list big' }, list.map(mvRow))
        : emptyState('Sin movimientos', 'No hay movimientos con estos filtros.',
            h('button', { class: 'btn btn-primary sm', onclick: () => movementForm() }, 'Nuevo movimiento')),
    );
  }
  draw();
  clear(root);
  root.append(container);
}

function mvRow(t) {
  const cat = store.category(t.categoryId);
  return h('li', { class: 'mv', onclick: () => movementForm(t), tabindex: '0',
    onkeydown: (e) => { if (e.key === 'Enter') movementForm(t); } }, [
    h('span', { class: 'av', style: { background: cat?.color || 'var(--sage)' } }, cat?.icon || '•'),
    h('div', { class: 'd' }, [
      h('div', { class: 't' }, t.description),
      h('div', { class: 's' }, [
        shortDate(t.date), ' · ',
        h('span', { class: 'tag-cat', style: { background: hexA(cat?.color, .12), color: cat?.color } }, cat?.name || 'Otros'),
        t.note ? h('span', { class: 'note-dot', title: t.note }, '• nota') : null,
      ]),
    ]),
    h('div', { class: 'amt ' + (t.type === 'INCOME' ? 'in' : 'out') + ' tnum' }, signedMoney(t.amount, t.type)),
  ]);
}

function renderCategorias(root) {
  const counts = new Map();
  store.transactions.forEach((t) => counts.set(t.categoryId, (counts.get(t.categoryId) || 0) + 1));
  const grid = h('div', { class: 'cat-grid' }, store.categories.map((c) => h('div', { class: 'cat-card' }, [
    h('div', { class: 'cat-ic', style: { background: c.color } }, c.icon),
    h('div', { class: 'cat-info' }, [
      h('div', { class: 'cat-nm' }, c.name),
      h('div', { class: 'cat-meta' }, c.isDefault ? 'Predeterminada' : `${counts.get(c.id) || 0} movimientos`),
    ]),
    h('div', { class: 'cat-actions' }, [
      h('button', { class: 'icon-btn sm', title: 'Editar', onclick: () => categoryForm(c) }, '✎'),
      !c.isDefault ? h('button', { class: 'icon-btn sm', title: 'Eliminar', onclick: async () => {
        if (!(await confirmDialog(`¿Eliminar la categoría "${c.name}"?`))) return;
        store.deleteCategory(c.id) ? toast('Categoría eliminada') : toast('No se puede: tiene movimientos', 'warn');
      } }, '🗑') : null,
    ]),
  ])));
  clear(root);
  root.append(
    h('div', { class: 'toolbar' }, [
      h('p', { class: 'muted' }, `${store.categories.length} categorías · usa las predeterminadas o crea las tuyas`),
      h('button', { class: 'btn btn-primary sm', onclick: () => categoryForm() }, '+ Nueva categoría'),
    ]),
    grid,
  );
}

function renderPresupuestos(root) {
  const list = inMonth(state.month, state.year);
  const spentBy = (id) => list.filter((t) => t.type === 'EXPENSE' && t.categoryId === id).reduce((a, t) => a + t.amount, 0);
  // categorías de gasto (todas menos Salario) + cualquiera con presupuesto
  const cats = store.categories.filter((c) => c.name !== 'Salario');
  const totBudget = store.budgets.filter((b) => b.month === state.month && b.year === state.year).reduce((a, b) => a + b.amount, 0);
  const totSpent = list.filter((t) => t.type === 'EXPENSE').reduce((a, t) => a + t.amount, 0);

  const rows = cats.map((c) => {
    const spent = spentBy(c.id);
    const b = store.budgetFor(c.id, state.month, state.year);
    const amount = b?.amount || 0;
    const input = h('input', { class: 'input slim tnum bud-input', type: 'number', min: '0', step: '10', placeholder: '—', value: amount || '' });
    input.addEventListener('change', () => {
      const v = parseFloat(input.value) || 0;
      store.setBudget(c.id, state.month, state.year, v);
      toast(v > 0 ? `Presupuesto de ${c.name}: ${money(v)}` : `Presupuesto de ${c.name} quitado`);
    });
    const meter = amount > 0 ? (() => {
      const st = budgetState(spent, amount);
      const fill = st.level === 'over' ? 'linear-gradient(90deg,var(--brass),var(--clay))'
        : st.level === 'warn' ? 'linear-gradient(90deg,var(--sage),var(--brass))' : 'var(--sage)';
      return h('div', {}, [
        h('div', { class: 'meter' }, [h('div', { class: 'lvl', style: { width: Math.min(100, st.pct) + '%', background: fill } }), h('div', { class: 'mark', style: { left: '80%' } })]),
        h('div', { class: 'bud-foot' }, [h('span', { class: 'flag ' + st.level }, [h('span', { class: 'd' }), st.label]), h('span', { class: 'pct tnum' }, Math.round(st.pct) + '%')]),
      ]);
    })() : h('div', { class: 'muted sm' }, 'Sin límite definido');

    return h('div', { class: 'bud-row' }, [
      h('div', { class: 'bud-cat' }, [h('span', { class: 'ic', style: { background: c.color } }, c.icon), h('span', { class: 'nm' }, c.name)]),
      h('div', { class: 'bud-mid' }, [
        h('div', { class: 'bud-figs' }, [h('span', { class: 'tnum spent' }, money(spent)), h('span', { class: 'muted' }, ' gastado')]),
        meter,
      ]),
      field('Límite', input),
    ]);
  });

  clear(root);
  root.append(
    h('div', { class: 'bud-summary' }, [
      sumPill('Presupuestado', money(totBudget), 'var(--pine)'),
      sumPill('Gastado', money(totSpent), 'var(--clay)'),
      sumPill('Disponible', money(Math.max(0, totBudget - totSpent)), 'var(--brass)'),
      h('div', { class: 'spacer' }),
      h('p', { class: 'muted sm' }, `Aviso automático al llegar al 80% · ${monthLabel(state.month, state.year)}`),
    ]),
    h('div', { class: 'bud-rows' }, rows),
  );
}

function renderReportes(root) {
  const list = inMonth(state.month, state.year);
  const t = totals(list);
  const cats = expenseByCategory(list);
  const savingRate = t.income > 0 ? Math.round((t.balance / t.income) * 100) : 0;

  // últimos 6 meses
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(state.year, state.month - i, 1);
    const l = inMonth(d.getMonth(), d.getFullYear());
    const tt = totals(l);
    months.push({ label: MONTHS_SHORT[d.getMonth()], income: tt.income, expense: tt.expense });
  }

  const legend = h('ul', { class: 'legend' }, cats.map((c) => h('li', {}, [
    h('span', { class: 'sw', style: { background: c.category.color } }),
    h('span', { class: 'lg-nm' }, c.category.name),
    h('span', { class: 'lg-amt tnum' }, money(c.value)),
    h('span', { class: 'lg-pct muted' }, t.expense > 0 ? Math.round(c.value / t.expense * 100) + '%' : '0%'),
  ])));

  clear(root);
  root.append(
    h('div', { class: 'toolbar' }, [
      h('p', { class: 'muted' }, `Resumen de ${monthLabel(state.month, state.year)}`),
      h('button', { class: 'btn btn-ghost sm', onclick: () => window.print() }, '⤓ Exportar PDF'),
    ]),
    h('div', { class: 'stat-grid four' }, [
      statCard('Ingresos', money(t.income), 'var(--pine)'),
      statCard('Gastos', money(t.expense), 'var(--clay)'),
      statCard('Balance', (t.balance >= 0 ? '+' : '−') + money(Math.abs(t.balance)), 'var(--brass)', true),
      statCard('Tasa de ahorro', savingRate + '%', 'var(--sage)'),
    ]),
    h('div', { class: 'grid-2' }, [
      card('Gastos por categoría', monthLabel(state.month, state.year),
        h('div', { class: 'donut-wrap' }, [
          h('div', { class: 'donut-chart', html: donut(cats.map((c) => ({ label: c.category.name, value: c.value, color: c.category.color })), { total: t.expense }) }),
          cats.length ? legend : emptyState('Sin gastos', 'No hay gastos este mes para graficar.'),
        ])),
      card('Ingresos y gastos', 'últimos 6 meses',
        h('div', { class: 'chart-pad', html: groupedBars(months, { width: 560, height: 240 }) })),
    ]),
  );
}

// ---------- Componentes compartidos ----------
function statCard(label, value, color, strong) {
  return h('div', { class: 'stat' + (strong ? ' strong' : '') }, [
    h('div', { class: 'k' }, [h('i', { style: { background: color } }), label]),
    h('div', { class: 'v tnum', style: strong ? { color } : {} }, value),
  ]);
}
function sumPill(label, value, color) {
  return h('div', { class: 'sum-pill' }, [h('span', { class: 'sp-k' }, label), h('span', { class: 'sp-v tnum', style: { color } }, value)]);
}
function card(title, sub, body, action) {
  return h('section', { class: 'panel' }, [
    h('div', { class: 'panel-head' }, [
      h('div', {}, [h('h3', {}, title), sub ? h('span', { class: 'sub' }, sub) : null]),
      action || null,
    ]),
    body,
  ]);
}
function emptyState(title, text, action) {
  return h('div', { class: 'empty' }, [h('div', { class: 'empty-ic' }, '◎'), h('p', { class: 'empty-t' }, title), h('p', { class: 'empty-s' }, text), action || null]);
}
function hexA(hex, a) {
  if (!hex) return `rgba(107,143,125,${a})`;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------- Router / shell ----------
const VIEWS = {
  resumen: { title: 'Resumen', render: renderResumen },
  movimientos: { title: 'Movimientos', render: renderMovimientos },
  categorias: { title: 'Categorías', render: renderCategorias },
  presupuestos: { title: 'Presupuestos', render: renderPresupuestos },
  reportes: { title: 'Reportes', render: renderReportes },
};

function go(view) {
  state.view = view;
  document.querySelectorAll('.side-nav a').forEach((a) => a.classList.toggle('active', a.dataset.view === view));
  document.getElementById('view-title').textContent = VIEWS[view].title;
  render();
}

function render() {
  document.getElementById('month-label').textContent = monthLabel(state.month, state.year);
  VIEWS[state.view].render(document.getElementById('view'));
}

function shiftMonth(delta) {
  const d = new Date(state.year, state.month + delta, 1);
  state.month = d.getMonth(); state.year = d.getFullYear();
  render();
}

function init() {
  // navegación lateral
  document.querySelectorAll('.side-nav a').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); go(a.dataset.view); }));
  document.getElementById('new-mv').addEventListener('click', () => movementForm());
  document.getElementById('prev-month').addEventListener('click', () => shiftMonth(-1));
  document.getElementById('next-month').addEventListener('click', () => shiftMonth(1));
  document.getElementById('reset-data').addEventListener('click', async () => {
    if (await confirmDialog('¿Restaurar los datos de ejemplo? Se perderán tus cambios.', { confirmText: 'Restaurar', danger: false })) { store.reset(); toast('Datos de ejemplo restaurados'); }
  });

  // re-render ante cualquier cambio del store
  store.subscribe(() => render());
  go('resumen');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
