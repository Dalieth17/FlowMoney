const HttpError = require('../utils/httpError');

// La API abierta no requiere claves. Solo se consulta USD/COP, nunca datos del usuario.
const URL = 'https://open.er-api.com/v6/latest/USD';
const HOUR = 3600000;

function createProvider({ fetcher = (...args) => fetch(...args), now = Date.now } = {}) {
  let cached, pending;
  async function fetchQuote() {
    try {
      const response = await fetcher(URL, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw Error('HTTP');
      const data = await response.json();
      const timestamp = data.time_last_update_unix * 1000;
      const rate = data.rates?.COP;
      if (
        data.result !== 'success' ||
        data.base_code !== 'USD' ||
        !Number.isFinite(rate) ||
        rate < 0.000001 ||
        rate > 1000000 ||
        !Number.isFinite(timestamp) ||
        timestamp > now() + 300000 ||
        now() - timestamp > 72 * HOUR
      )
        throw Error('Cotización inválida o vencida');
      cached = {
        quote: {
          copPerUsd: Math.round(rate * 1e6) / 1e6,
          source: 'automatic',
          quotedAt: new Date(timestamp).toISOString(),
        },
        fetchedAt: now(),
      };
      return cached.quote;
    } catch {
      throw new HttpError(
        503,
        'No se pudo consultar la tasa automática. Inténtalo de nuevo o introduce una tasa manual.',
      );
    }
  }
  return {
    async quote() {
      if (cached && now() - cached.fetchedAt < HOUR && now() - Date.parse(cached.quote.quotedAt) <= 72 * HOUR)
        return cached.quote;
      if (!pending)
        pending = fetchQuote().finally(() => {
          pending = null;
        });
      return pending;
    },
  };
}

const provider = createProvider();
async function validateExchange(exchange) {
  if (exchange.source === 'manual') return { ...exchange, quotedAt: new Date().toISOString() };
  const quote = await provider.quote();
  if (quote.copPerUsd !== exchange.copPerUsd || quote.quotedAt !== exchange.quotedAt)
    throw HttpError.conflict('La tasa cambió. Consulta de nuevo la cotización antes de convertir.');
  return { ...exchange, ...quote };
}

module.exports = { createProvider, quote: () => provider.quote(), validateExchange };
