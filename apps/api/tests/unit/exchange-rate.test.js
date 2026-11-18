require('../helpers');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createProvider } = require('../../src/services/exchangeRateService');
const { converter } = require('../../src/services/currencyConversion');
const { profileSchema } = require('../../src/validation/schemas');
const NOW = Date.parse('2026-11-18T12:00:00Z');
const data = (extra = {}) => ({
  result: 'success',
  base_code: 'USD',
  rates: { COP: 4000.1234567 },
  time_last_update_unix: NOW / 1000,
  ...extra,
});
const response = (body) => ({ ok: true, json: async () => body });

test('cotización: una consulta concurrente, caché de una hora y renovación', async () => {
  let calls = 0,
    time = NOW;
  const provider = createProvider({
    now: () => time,
    fetcher: async () => {
      calls++;
      return response(data());
    },
  });
  const quotes = await Promise.all([provider.quote(), provider.quote(), provider.quote()]);
  assert.equal(calls, 1);
  assert.equal(quotes[0].copPerUsd, 4000.123457);
  assert.equal(quotes[0].quotedAt, new Date(NOW).toISOString());
  await provider.quote();
  assert.equal(calls, 1);
  time += 3600001;
  await provider.quote();
  assert.equal(calls, 2);
});

test('cotización: no publica tasas inválidas, vencidas ni errores como si fueran actuales', async () => {
  for (const body of [
    data({ result: 'error' }),
    data({ base_code: 'EUR' }),
    data({ rates: {} }),
    data({ rates: { COP: -1 } }),
    data({ rates: { COP: '4000' } }),
    data({ time_last_update_unix: (NOW - 73 * 3600000) / 1000 }),
    data({ time_last_update_unix: (NOW + 3600000) / 1000 }),
  ]) {
    const provider = createProvider({ now: () => NOW, fetcher: async () => response(body) });
    await assert.rejects(provider.quote(), { status: 503 });
  }
  let calls = 0;
  const failing = createProvider({
    fetcher: async () => {
      calls++;
      throw Error('Red caída');
    },
  });
  await assert.rejects(failing.quote(), { status: 503 });
  await assert.rejects(failing.quote(), { status: 503 });
  assert.equal(calls, 2, 'un fallo no queda cacheado');
});

test('conversión decimal: sentido, negativos, medio centavo y límites', () => {
  const usd = converter('COP', 4000),
    cop = converter('USD', 4000);
  assert.equal(usd(1000000), 250);
  assert.equal(cop(250), 1000000);
  assert.equal(usd(-400000), -100);
  assert.equal(usd(60), 0.02, '0.015 USD se redondea a 0.02');
  assert.equal(usd(-60), -0.02);
  assert.throws(() => usd(1, true), /por debajo/);
  assert.throws(() => cop(9999999999.99, true), /máximo/);
});

test('la tasa requiere número positivo finito con hasta seis decimales y origen conocido', () => {
  const payload = {
    name: 'Pruebas',
    currency: 'USD',
    exchange: { fromCurrency: 'COP', source: 'manual', copPerUsd: 4000 },
  };
  assert.ok(profileSchema.safeParse(payload).success);
  for (const copPerUsd of [0, -1, Infinity, NaN, '4000', 1000001, 4000.1234567])
    assert.equal(profileSchema.safeParse({ ...payload, exchange: { ...payload.exchange, copPerUsd } }).success, false);
});
