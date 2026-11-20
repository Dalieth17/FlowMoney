import { h, field, mount, downloadText } from '../ui/dom.js';
import { openModal, toast, runAction } from '../ui/feedback.js';
import { api } from '../core/api.js';
import { store } from '../core/store.js';
import { signedMoney } from '../core/format.js';
import { transactionsCsv } from '../domain/transactionCsv.js';

const STATUS = { NEW: 'Nuevo', EXISTING: 'Ya existe', EXCLUDED: 'Operación excluida', ERROR: 'Error' };
export function openTransactionImport() {
  const currency = store.user.currency;
  let selection = 0,
    candidate = null,
    opened = true,
    committing = false;
  const file = h('input', { class: 'input', type: 'file', accept: '.csv,text/csv' });
  const result = h('div', { 'aria-live': 'polite' });
  const error = h('p', { class: 'note-banner', role: 'alert', hidden: true });
  const confirm = h('button', { class: 'btn btn-primary', type: 'button', disabled: true }, 'Importar movimientos');
  const review = h(
    'button',
    { class: 'btn btn-ghost', type: 'button', disabled: true, onclick: () => inspect() },
    'Revisar archivo',
  );
  const template = h(
    'button',
    {
      class: 'btn btn-ghost',
      type: 'button',
      onclick: () => {
        downloadText(
          'flowmoney-plantilla.csv',
          transactionsCsv(
            [
              {
                date: Date.now(),
                description: 'Ejemplo de gasto',
                type: 'EXPENSE',
                amount: 1,
                categoryId: store.categories[0]?.id,
                accountId: store.accounts[0]?.id,
                note: '',
              },
            ],
            { categories: store.categories, accounts: store.accounts, currency },
          ),
        );
      },
    },
    'Descargar plantilla',
  );
  const active = (current) => opened && selection === current && store.user.currency === currency;
  const message = (text) => {
    error.textContent = text;
    error.hidden = false;
  };
  const content = h('div', { class: 'form' }, [
    h(
      'p',
      {},
      `Añade movimientos individuales en ${currency}. Descarga la plantilla o usa un CSV exportado con la versión actual de FlowMoney. No se reemplazan datos existentes.`,
    ),
    h('details', {}, [
      h('summary', {}, 'Formato del archivo y coincidencias'),
      h(
        'p',
        { class: 'field-hint' },
        'Máximo 500 filas y 256 KB. Usa fechas AAAA-MM-DD, montos sin miles y decimales con punto. Las categorías y cuentas deben existir con esos nombres; deja Cuenta vacía si no corresponde.',
      ),
      h(
        'p',
        { class: 'field-hint' },
        'Las coincidencias existentes se omiten. Las transferencias, conciliaciones y sus comisiones se excluyen: para conservar operaciones, recurrencias y metas usa el respaldo JSON.',
      ),
    ]),
    template,
    field('Archivo CSV', file),
    review,
    error,
    result,
    h('div', { class: 'modal-actions' }, [confirm]),
  ]);
  const unsubscribe = store.subscribe(() => {
    if (store.user.currency !== currency) {
      selection++;
      candidate = null;
      confirm.disabled = true;
      review.disabled = true;
      file.disabled = true;
      template.disabled = true;
      message('La moneda cambió. Cierra y abre de nuevo el importador.');
    }
  });
  const modal = openModal('Importar movimientos CSV', content, {
    onClose: () => {
      opened = false;
      selection++;
      unsubscribe();
    },
  });
  file.addEventListener('change', () => inspect());
  async function inspect() {
    if (committing || !opened || store.user.currency !== currency) return;
    const current = ++selection;
    candidate = null;
    confirm.disabled = true;
    review.disabled = true;
    error.hidden = true;
    mount(result);
    const selected = file.files?.[0];
    if (!selected) return;
    try {
      if (selected.size > 256 * 1024) throw Error('El archivo supera 256 KB');
      result.textContent = 'Revisando archivo…';
      const csv = await selected.text();
      if (!active(current)) return;
      const data = await api.post('/transactions/import/preview', { csv, currency });
      if (!active(current)) return;
      candidate = { csv, currency, digest: data.digest };
      const s = data.summary;
      mount(
        result,
        h(
          'p',
          { class: 'note-banner' },
          `${s.new} nuevos · ${s.existing} coincidencias · ${s.excluded} operaciones excluidas · ${s.errors} errores`,
        ),
        h(
          'div',
          { class: 'csv-preview', tabindex: '0', role: 'region', 'aria-label': 'Vista previa de importación' },
          h('table', { class: 'report-table' }, [
            h('caption', {}, 'Revisa los movimientos antes de confirmar'),
            h(
              'thead',
              {},
              h(
                'tr',
                {},
                ['Línea', 'Fecha y descripción', 'Monto', 'Resultado'].map((t) => h('th', { scope: 'col' }, t)),
              ),
            ),
            h(
              'tbody',
              {},
              data.rows.map((row) =>
                h('tr', {}, [
                  h('td', {}, row.line),
                  h('td', {}, [
                    h('div', {}, `${row.date} · ${row.description}`),
                    h('small', { class: 'muted' }, `${row.category || ''} · ${row.account || 'Sin cuenta'}`),
                    row.transaction?.note ? h('div', { class: 'muted' }, `Nota: ${row.transaction.note}`) : null,
                  ]),
                  h(
                    'td',
                    { class: 'tnum' },
                    row.transaction ? signedMoney(row.transaction.amount, row.transaction.type) : '—',
                  ),
                  h('td', {}, row.error || STATUS[row.status]),
                ]),
              ),
            ),
          ]),
        ),
      );
      confirm.textContent = `Importar ${s.new} movimiento${s.new === 1 ? '' : 's'}`;
      confirm.disabled = !data.valid || s.new === 0;
      if (s.errors)
        message(
          'Corrige las filas con errores en el archivo y vuelve a seleccionarlo. No se ha guardado ningún movimiento.',
        );
      else if (!s.new)
        message('No hay movimientos nuevos para importar. Las coincidencias y operaciones especiales no se añaden.');
      if (data.valid && !s.new && s.existing) {
        const refresh = h(
          'button',
          {
            class: 'btn btn-ghost',
            type: 'button',
            onclick: () =>
              runAction(refresh, async () => {
                await store.load();
                modal.close();
              }),
          },
          'Actualizar panel',
        );
        result.append(refresh);
      }
    } catch (err) {
      if (active(current)) {
        mount(result);
        message(err.message);
      }
    } finally {
      if (active(current)) review.disabled = false;
    }
  }
  confirm.addEventListener('click', async () => {
    if (committing || confirm.disabled || !candidate) return;
    committing = true;
    confirm.disabled = true;
    review.disabled = true;
    file.disabled = true;
    template.disabled = true;
    error.hidden = true;
    confirm.setAttribute('aria-busy', 'true');
    try {
      const saved = await store.importTransactions(candidate);
      modal.close();
      toast(`${saved.imported} movimientos importados; ${saved.skipped} coincidencias omitidas`);
    } catch (err) {
      if (opened) {
        candidate = null;
        message(`${err.message}. Vuelve a revisar el archivo antes de reintentar.`);
      }
    } finally {
      committing = false;
      confirm.removeAttribute('aria-busy');
      if (opened && store.user.currency === currency) {
        review.disabled = false;
        file.disabled = false;
        template.disabled = false;
      }
    }
  });
}
