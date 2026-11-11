// db.js — conexión a MySQL, migración del esquema y siembra por usuario.
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const cfg = {
  host: process.env.DB_HOST || 'db',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'flowmoney',
  password: process.env.DB_PASSWORD || 'flowmoney',
  database: process.env.DB_NAME || 'flowmoney',
};

// Pool principal para las consultas de la app.
const pool = mysql.createPool({
  ...cfg,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: false,
  decimalNumbers: true, // DECIMAL -> number (evita strings en JSON)
});

// Espera a que MySQL acepte conexiones (el contenedor tarda en levantar).
async function waitForDb(retries = 30, delayMs = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      const c = await mysql.createConnection(cfg);
      await c.ping();
      await c.end();
      return;
    } catch (e) {
      console.log(`[db] esperando MySQL (${i}/${retries})… ${e.code || e.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('No se pudo conectar a MySQL');
}

// Ejecuta el DDL (idempotente).
async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const c = await mysql.createConnection({ ...cfg, multipleStatements: true });
  await c.query(sql);
  await c.end();
  console.log('[db] esquema listo');
}

async function init() {
  await waitForDb();
  await migrate();
}

// ---- Datos por defecto para un usuario nuevo ----
const DEFAULT_CATEGORIES = [
  { name: 'Alimentación',    icon: '🍽', color: '#C25A44' },
  { name: 'Transporte',      icon: '🚌', color: '#3E78A8' },
  { name: 'Entretenimiento', icon: '🎬', color: '#7A5BA8' },
  { name: 'Salud',           icon: '🩺', color: '#5B9E86' },
  { name: 'Educación',       icon: '📚', color: '#D9A648' },
  { name: 'Servicios',       icon: '💡', color: '#C08A3E' },
  { name: 'Hogar',           icon: '🏠', color: '#A86A54' },
  { name: 'Salario',         icon: '💼', color: '#1F4D3A' },
  { name: 'Otros',           icon: '✨', color: '#8A94A6' },
];

// Crea categorías, cuentas y movimientos de ejemplo del mes actual.
async function seedUserData(userId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // categorías
    const catId = {};
    for (const c of DEFAULT_CATEGORIES) {
      const [r] = await conn.query(
        'INSERT INTO categories (user_id,name,icon,color,is_default) VALUES (?,?,?,?,1)',
        [userId, c.name, c.icon, c.color],
      );
      catId[c.name] = r.insertId;
    }

    // cuentas
    const [acc] = await conn.query(
      'INSERT INTO accounts (user_id,name,type,initial_balance) VALUES (?,?,?,0)',
      [userId, 'Efectivo', 'CASH'],
    );
    await conn.query('INSERT INTO accounts (user_id,name,type,initial_balance) VALUES (?,?,?,0)', [userId, 'Banco', 'BANK']);
    const accountId = acc.insertId;

    // movimientos de ejemplo (mes actual)
    const now = new Date();
    const at = (d) => new Date(now.getFullYear(), now.getMonth(), d, 12, 0, 0).getTime();
    const sample = [
      ['Sueldo del mes',    4200.00, 'INCOME',  'Salario',         3,  ''],
      ['Freelance diseño',   650.00, 'INCOME',  'Salario',         15, ''],
      ['Plaza Vea',          210.40, 'EXPENSE', 'Alimentación',    5,  'Compra semanal'],
      ['Wong',               165.00, 'EXPENSE', 'Alimentación',    19, ''],
      ["McDonald's",          28.90, 'EXPENSE', 'Alimentación',    8,  ''],
      ['Starbucks',           12.50, 'EXPENSE', 'Alimentación',    11, ''],
      ['Grifo Primax',       120.00, 'EXPENSE', 'Transporte',      6,  ''],
      ['Uber',                14.50, 'EXPENSE', 'Transporte',      9,  ''],
      ['Metropolitano',       30.00, 'EXPENSE', 'Transporte',      22, 'Recarga'],
      ['Netflix',             44.90, 'EXPENSE', 'Entretenimiento', 10, ''],
      ['Spotify',             21.90, 'EXPENSE', 'Entretenimiento', 14, ''],
      ['Cineplanet',          36.00, 'EXPENSE', 'Entretenimiento', 23, ''],
      ['Inkafarma',           58.00, 'EXPENSE', 'Salud',           7,  ''],
      ['Consulta médica',    180.00, 'EXPENSE', 'Salud',           18, ''],
      ['Recibo de luz',       95.50, 'EXPENSE', 'Servicios',       4,  ''],
      ['Internet Movistar',  120.00, 'EXPENSE', 'Servicios',       4,  ''],
      ['Agua',                45.00, 'EXPENSE', 'Servicios',       12, ''],
    ];
    for (const [desc, amount, type, cat, day, note] of sample) {
      await conn.query(
        'INSERT INTO transactions (user_id,amount,description,date,type,category_id,account_id,note) VALUES (?,?,?,?,?,?,?,?)',
        [userId, amount, desc, at(day), type, catId[cat], accountId, note],
      );
    }

    // presupuestos del mes
    const m = now.getMonth(), y = now.getFullYear();
    const budgets = [['Alimentación', 400], ['Transporte', 200], ['Entretenimiento', 140], ['Salud', 250], ['Servicios', 300]];
    for (const [cat, amount] of budgets) {
      await conn.query('INSERT INTO budgets (user_id,category_id,amount,month,year) VALUES (?,?,?,?,?)', [userId, catId[cat], amount, m, y]);
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = { pool, init, seedUserData, DEFAULT_CATEGORIES };
