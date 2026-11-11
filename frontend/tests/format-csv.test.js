import { describe, test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  money,
  signedMoney,
  signedBalance,
  setCurrency,
  isoDate,
  isoDateToMs,
  compact,
} from '../public/assets/js/core/format.js';
import { csvCell, toCsv } from '../public/assets/js/domain/csv.js';

describe('money', () => {
  afterEach(() => setCurrency('$'));

  test('formatea con separador de miles y 2 decimales', () => {
    assert.equal(money(1639.5), '$1,639.50');
    assert.equal(money(-20), '-$20.00');
    assert.equal(money(undefined), '$0.00');
  });

  test('respeta la moneda del usuario ("S/" lleva espacio)', () => {
    setCurrency('S/');
    assert.equal(money(25), 'S/ 25.00');
    setCurrency('€');
    assert.equal(money(25), '€25.00');
  });

  test('ignora monedas no soportadas', () => {
    setCurrency('BTC');
    assert.equal(money(1), '$1.00');
  });

  test('signos de movimientos y balances', () => {
    assert.equal(signedMoney(10, 'INCOME'), '+$10.00');
    assert.equal(signedMoney(10, 'EXPENSE'), '−$10.00');
    assert.equal(signedBalance(-5), '−$5.00');
  });

  test('números compactos para ejes', () => {
    assert.equal(compact(1200), '1.2k');
    assert.equal(compact(2000), '2k');
    assert.equal(compact(950), '950');
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
