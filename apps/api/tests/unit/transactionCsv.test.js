require('../helpers');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readCsv, decodeRows, fingerprint, MAX_BYTES } = require('../../src/utils/transactionCsv');
const header = 'Fecha,Descripción,Tipo,Categoría,Cuenta,Monto (COP),Nota,Clase,Operación';
const line = '2026-11-19,Café,Gasto,Comida,Banco,-12.50,,NORMAL,';
const categories = [{ id: 1, name: 'Comida' }],
  accounts = [{ id: 2, name: 'Banco' }];
const decode = (source) => decodeRows(readCsv(source).rows, categories, accounts);
test('CSV con BOM, comas, comillas y líneas dentro de campos conserva texto y números de línea', () => {
  const source = `\uFEFF${header}\r\n2026-11-19,"Café, dijo ""hola""",Gasto,Comida,Banco,-12.50,"primera\r\nsegunda",NORMAL,\r\n${line}\r\n`;
  const parsed = readCsv(source);
  assert.equal(parsed.currency, 'COP');
  assert.deepEqual(
    parsed.rows.map((r) => r.line),
    [2, 4],
  );
  const rows = decodeRows(parsed.rows, categories, accounts);
  assert.equal(rows[0].transaction.description, 'Café, dijo "hola"');
  assert.equal(rows[0].transaction.note, 'primera\nsegunda');
  assert.equal(rows[0].transaction.amount, 12.5);
});
test('rechaza formato anterior, comillas rotas, columnas sobrantes y filas sin encabezados', () => {
  for (const source of [
    '',
    header,
    `${header}\n"sin cerrar`,
    `${header}\n${line},otra`,
    'Fecha,Descripción\n2026-11-19,Compra',
  ])
    assert.throws(() => readCsv(source), { status: 400 });
});
test('límites de filas y bytes UTF-8 son explícitos', () => {
  assert.equal(readCsv(`${header}\n${Array(500).fill(line).join('\n')}`).rows.length, 500);
  assert.throws(() => readCsv(`${header}\n${Array(501).fill(line).join('\n')}`), /500/);
  assert.throws(() => readCsv('á'.repeat(MAX_BYTES / 2 + 1)), /256 KB/);
});
test('fechas imposibles, importes ambiguos o fracciones de céntimo quedan como errores de fila', () => {
  for (const text of [
    line.replace('2026-11-19', '2026-02-30'),
    line.replace('-12.50', '0.001'),
    line.replace('-12.50', '"1.234,56"'),
    line.replace('-12.50', '0'),
    line.replace('Gasto', 'Ingreso'),
  ]) {
    const row = decode(`${header}\n${text}`)[0];
    assert.equal(row.status, 'ERROR');
    assert.equal(row.transaction, undefined);
  }
});
test('referencias ambiguas no eligen una categoría o cuenta arbitraria', () => {
  const parsed = readCsv(`${header}\n${line}`);
  const rows = decodeRows(parsed.rows, [...categories, { id: 3, name: 'comida' }], accounts);
  assert.equal(rows[0].status, 'ERROR');
  assert.match(rows[0].error, /ambigua/);
  assert.match(decode(`${header}\n${line.replace('Comida', 'Ausente')}`)[0].error, /no encontrada/);
});
test('operaciones especiales y sus comisiones se excluyen juntas', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  for (const kind of ['TRANSFER', 'ADJUSTMENT', 'NORMAL'])
    assert.equal(decode(`${header}\n${line.replace('NORMAL,', `${kind},${id}`)}`)[0].status, 'EXCLUDED');
});
test('coincidencia usa el día colombiano y normaliza Unicode y saltos de línea', () => {
  const tx = {
    date: Date.parse('2026-11-20T04:59:59.999Z'),
    type: 'EXPENSE',
    amount: 12.5,
    description: 'Café',
    categoryId: 1,
    accountId: null,
    note: 'a\r\nb',
  };
  assert.equal(
    fingerprint(tx),
    fingerprint({ ...tx, date: Date.parse('2026-11-19T17:00:00Z'), description: 'Cafe\u0301', note: 'a\nb' }),
  );
  assert.notEqual(fingerprint(tx), fingerprint({ ...tx, date: Date.parse('2026-11-20T05:00:00Z') }));
});
test('exportación web e importación son compatibles y no pierden apóstrofos ni texto de fórmula', async () => {
  const { transactionsCsv } = await import('../../../web/public/assets/js/domain/transactionCsv.js');
  const values = ['=literal', "'=con apóstrofo", 'Café, "grande"', 'Dos\nlineas'];
  const txs = values.map((description) => ({
    date: Date.parse('2026-11-19T17:00:00Z'),
    description,
    type: 'EXPENSE',
    amount: 12.5,
    categoryId: 1,
    accountId: 2,
    note: "'nota",
  }));
  const csv = transactionsCsv(txs, { categories, accounts, currency: 'COP' });
  const rows = decode(csv);
  assert.deepEqual(
    rows.map((r) => r.transaction.description),
    values,
  );
  assert.ok(rows.every((r) => r.transaction.note === "'nota"));
});
