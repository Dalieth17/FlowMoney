import { h, field } from './dom.js';
import { api } from '../core/api.js';
import { money } from '../core/format.js';

const rateLabel = (n) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 6 }).format(n);
const dateLabel = (value) =>
  new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

/** Cotización visible y editable solo al cambiar de moneda. Ignora respuestas anteriores. */
export function currencyExchange(select, user) {
  let quote = null,
    revision = 0;
  const mode = h('select', { class: 'input' }, [
    h('option', { value: 'automatic' }, 'Tasa automática'),
    h('option', { value: 'manual' }, 'Introducir tasa manual'),
  ]);
  const rate = h('input', {
    class: 'input',
    type: 'number',
    min: '0.000001',
    max: '1000000',
    step: '0.000001',
    inputmode: 'decimal',
    disabled: true,
  });
  const status = h('p', { class: 'field-hint', role: 'status', 'aria-live': 'polite' });
  const preview = h('p', { class: 'field-hint', 'aria-live': 'polite' });
  const refresh = h('button', { type: 'button', class: 'btn btn-ghost sm', onclick: consult }, 'Consultar tasa');
  const source = h('p', { class: 'field-hint' }, [
    'Fuente automática: ',
    h('a', { href: 'https://www.exchangerate-api.com', target: '_blank', rel: 'noopener' }, 'ExchangeRate-API'),
    '. Tasa de referencia; tu banco puede aplicar otra.',
  ]);
  const element = h('div', { hidden: true }, [
    field('Origen de la tasa', mode),
    field('Pesos colombianos por 1 USD', rate, 'Por ejemplo, 4000 significa que 1 USD equivale a 4.000 COP.'),
    status,
    source,
    preview,
    refresh,
  ]);
  function showPreview() {
    const n = Number(rate.value);
    preview.textContent =
      n > 0 && Number.isFinite(n)
        ? `1 USD = ${rateLabel(n)} COP. Ejemplo: ${
            user.currency === 'COP'
              ? `${money(1000000, 'COP')} ≈ ${money(1000000 / n, 'USD')}`
              : `${money(100, 'USD')} ≈ ${money(100 * n, 'COP')}`
          }.`
        : '';
  }
  async function consult() {
    const current = ++revision;
    mode.value = 'automatic';
    rate.disabled = true;
    quote = null;
    rate.value = '';
    refresh.disabled = true;
    status.textContent = 'Consultando tasa de cambio…';
    showPreview();
    try {
      const result = await api.get('/profile/exchange-rate');
      if (current !== revision) return;
      quote = result;
      rate.value = String(result.copPerUsd);
      status.textContent = `Cotización del ${dateLabel(result.quotedAt)} (hora de Colombia).`;
    } catch (err) {
      if (current !== revision) return;
      mode.value = 'manual';
      rate.disabled = false;
      status.textContent = err.message || 'No se pudo consultar la tasa. Introduce una tasa manual.';
    } finally {
      if (current === revision) {
        refresh.disabled = false;
        showPreview();
      }
    }
  }
  mode.addEventListener('change', () => {
    revision++;
    quote = null;
    rate.disabled = mode.value === 'automatic';
    refresh.disabled = false;
    if (mode.value === 'automatic') consult();
    else status.textContent = 'Tasa manual: comprueba el valor antes de confirmar.';
  });
  rate.addEventListener('input', showPreview);
  select.addEventListener('change', () => {
    revision++;
    element.hidden = select.value === user.currency;
    if (!element.hidden && mode.value === 'automatic') consult();
  });

  return {
    element,
    change() {
      const n = Number(rate.value);
      if (!Number.isFinite(n) || n < 0.000001 || n > 1000000 || Math.abs(n * 1e6 - Math.round(n * 1e6)) >= 0.001)
        throw Error('Introduce una tasa mayor que cero, hasta 1.000.000 y con un máximo de 6 decimales.');
      if (mode.value === 'automatic' && !quote) throw Error('Espera la cotización o elige una tasa manual.');
      return {
        fromCurrency: user.currency,
        copPerUsd: n,
        source: mode.value,
        ...(mode.value === 'automatic' ? { quotedAt: quote.quotedAt } : {}),
      };
    },
  };
}

export function currencyChangeNote(change) {
  return `Última conversión: ${change.fromCurrency} → ${change.toCurrency}, 1 USD = ${rateLabel(change.copPerUsd)} COP. Tasa ${change.source === 'manual' ? 'manual' : 'de ExchangeRate-API'}, cotizada el ${dateLabel(change.quotedAt)} y aplicada el ${dateLabel(change.createdAt)}.`;
}
