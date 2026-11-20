const HttpError = require('./httpError');
const { transactionSchema } = require('../validation/schemas');

const HEADERS = ['Fecha', 'Descripción', 'Tipo', 'Categoría', 'Cuenta', 'Monto', 'Nota', 'Clase', 'Operación'];
const MAX_ROWS = 500;
const MAX_BYTES = 256 * 1024;
const nameKey = (text) => text.normalize('NFC').trim().toLocaleLowerCase('es');
const fromCell = (text) => (/^'[=+\-@'\t\r\n]/.test(text) ? text.slice(1) : text);
const dayOf = (timestamp) => new Date(timestamp - 18000000).toISOString().slice(0, 10);

// RFC 4180: comas, comillas escapadas, BOM y campos con saltos de línea.
function readCsv(source) {
  if (Buffer.byteLength(source, 'utf8') > MAX_BYTES) throw HttpError.badRequest('El CSV supera 256 KB');
  const text = source.replace(/^\uFEFF/, '');
  const rows = [];
  let cells = [],
    field = '',
    quoted = false,
    closed = false,
    line = 1,
    start = 1;
  const fail = () => {
    throw HttpError.badRequest(`CSV no válido cerca de la línea ${line}: revisa las comillas y las comas`);
  };
  const finish = () => {
    cells.push(field);
    if (cells.some((cell) => cell.trim())) rows.push({ line: start, cells });
    if (rows.length > MAX_ROWS + 1) throw HttpError.badRequest('Importa como máximo 500 movimientos por archivo');
    cells = [];
    field = '';
    closed = false;
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i],
      newline = char === '\r' || char === '\n';
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else if (newline) {
        field += '\n';
        line++;
        if (char === '\r' && text[i + 1] === '\n') i++;
      } else field += char;
      continue;
    }
    if (char === ',') {
      cells.push(field);
      field = '';
      closed = false;
      if (cells.length >= HEADERS.length) fail();
    } else if (newline) {
      finish();
      line++;
      if (char === '\r' && text[i + 1] === '\n') i++;
      start = line;
    } else if (char === '"') {
      if (field || closed) fail();
      quoted = true;
    } else {
      if (closed) fail();
      field += char;
    }
  }
  if (quoted) fail();
  if (field || cells.length || closed) finish();
  if (rows.length < 2) throw HttpError.badRequest('El CSV debe contener encabezados y al menos un movimiento');
  const headers = rows.shift().cells.map((cell) => cell.trim());
  const currency = headers[5]?.match(/^Monto \((COP|USD)\)$/)?.[1];
  if (!currency || headers.length !== HEADERS.length || headers.some((h, i) => i !== 5 && h !== HEADERS[i]))
    throw HttpError.badRequest(
      'Usa la plantilla CSV actual de FlowMoney, con columnas Clase y Operación y monto en COP o USD',
    );
  return { currency, rows };
}

function names(items) {
  const map = new Map();
  for (const item of items) {
    const key = nameKey(item.name);
    map.set(key, map.has(key) ? null : item.id);
  }
  return (name, label, optional = false) => {
    if (!name.trim() && optional) return null;
    const id = map.get(nameKey(name));
    if (id === null) throw Error(`${label} ambigua: hay varios nombres iguales. Renómbralos antes de importar`);
    if (id === undefined) throw Error(`${label} no encontrada. Créala en la app o corrige el nombre en el CSV`);
    return id;
  };
}
function decodeRows(records, categories, accounts) {
  const categoryId = names(categories),
    accountId = names(accounts);
  return records.map(({ line, cells }) => {
    const [date, description, type, category, account, amount, note, kind, operation] = cells.map((cell) =>
      fromCell(cell).trim(),
    );
    const row = { line, date, description, category, account, amount, status: 'NEW' };
    try {
      if (cells.length !== HEADERS.length) throw Error('La fila no tiene las nueve columnas de la plantilla');
      if (!['NORMAL', 'TRANSFER', 'ADJUSTMENT'].includes(kind))
        throw Error('Clase no válida: usa NORMAL para movimientos individuales');
      if (operation && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(operation))
        throw Error('Identificador de operación no válido');
      if (kind !== 'NORMAL' || operation) return { ...row, status: 'EXCLUDED' };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Error('Fecha no válida: usa AAAA-MM-DD');
      const timestamp = Date.parse(`${date}T17:00:00Z`);
      if (!Number.isFinite(timestamp) || dayOf(timestamp) !== date) throw Error('La fecha no existe');
      if (!/^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(amount))
        throw Error('Usa un monto sin separadores de miles y con hasta dos decimales separados por punto');
      const txType = { ingreso: 'INCOME', gasto: 'EXPENSE' }[nameKey(type)];
      if (!txType) throw Error('Tipo no válido: usa Ingreso o Gasto');
      if (txType === 'INCOME' && Number(amount) < 0) throw Error('El ingreso no puede tener monto negativo');
      const result = transactionSchema.safeParse({
        description,
        amount: Math.abs(Number(amount)),
        type: txType,
        categoryId: categoryId(category, 'Categoría'),
        accountId: accountId(account, 'Cuenta', true),
        date: timestamp,
        note,
      });
      if (!result.success) throw Error(result.error.issues[0].message);
      return { ...row, transaction: result.data };
    } catch (err) {
      return { ...row, status: 'ERROR', error: err.message };
    }
  });
}
// CSV guarda días civiles, no horas. Se mantiene la multiplicidad de filas idénticas.
function fingerprint(tx) {
  const text = (value) => value.normalize('NFC').replace(/\r\n?/g, '\n');
  return JSON.stringify([
    dayOf(tx.date),
    tx.type,
    Math.round(tx.amount * 100),
    text(tx.description),
    tx.categoryId,
    tx.accountId ?? null,
    text(tx.note || ''),
  ]);
}
module.exports = { readCsv, decodeRows, fingerprint, MAX_BYTES, MAX_ROWS };
