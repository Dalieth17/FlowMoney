import { describe, test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  money,
  signedMoney,
  signedBalance,
  setCurrency,
  getCurrency,
  isoDate,
  isoDateToMs,
  compact,
} from '../public/assets/js/core/format.js';
import { csvCell, toCsv } from '../public/assets/js/domain/csv.js';

describe('money', () => {
  afterEach(() => setCurrency('COP'));

  test('pesos colombianos: punto de miles y sin decimales si no hay centavos', () => {
    assert.equal(money(4500000), '$ 4.500.000');
    assert.equal(money(1639.5), '$ 1.639,50');
    assert.equal(money(-20000), '-$ 20.000');
    assert.equal(money(undefined), '$ 0');
    assert.equal(getCurrency(), 'COP');
  });

  test('dólares: coma de miles y siempre 2 decimales', () => {
    setCurrency('USD');
    assert.equal(money(1639.5), 'US$ 1,639.50');
    assert.equal(money(25), 'US$ 25.00');
    assert.equal(getCurrency(), 'USD');
  });

  test('ignora monedas no soportadas', () => {
    setCurrency('BTC');
    assert.equal(money(1), '$ 1');
  });

  test('signos de movimientos y balances', () => {
    assert.equal(signedMoney(10000, 'INCOME'), '+$ 10.000');
    assert.equal(signedMoney(10000, 'EXPENSE'), '−$ 10.000');
    assert.equal(signedBalance(-5000), '−$ 5.000');
  });

  test('números compactos para ejes', () => {
    assert.equal(compact(1200), '1.2k');
    assert.equal(compact(2000), '2k');
    assert.equal(compact(950), '950');
    assert.equal(compact(4500000), '4.5M');
    assert.equal(compact(2000000), '2M');
  });
});

describe('fechas', () => {
  test('isoDate e isoDateToMs son inversas (fecha local)', () => {
    assert.equal(isoDate(isoDateToMs('2026-11-08')), '2026-11-08');
    assert.equal(isoDate(isoDateToMs('2026-01-01')), '2026-01-01');
  });
});

describe('CSV', () => {
  test('escapa comas, comillas y saltos de línea', () => {
    assert.equal(csvCell('a,b'), '"a,b"');
    assert.equal(csvCell('dijo "hola"'), '"dijo ""hola"""');
    assert.equal(csvCell('línea\nnueva'), '"línea\nnueva"');
  });

  test('neutraliza fórmulas en texto, pero no toca números', () => {
    assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
    assert.equal(csvCell('+51 999'), "'+51 999");
    assert.equal(csvCell(-28.9), '-28.9');
    assert.equal(csvCell(null), '');
  });

  test('toCsv arma encabezado y filas con CRLF', () => {
    const csv = toCsv(
      [{ d: 'Uber', m: -14.5 }],
      [
        { header: 'Descripción', value: (r) => r.d },
        { header: 'Monto', value: (r) => r.m },
      ],
    );
    assert.equal(csv, 'Descripción,Monto\r\nUber,-14.5');
  });
});
