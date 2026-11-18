// Pool de conexiones MySQL + helper de transacciones.
const mysql = require('mysql2/promise');
const config = require('../config');
const currencyContext = require('../utils/currencyContext');

const connectionOptions = Object.freeze({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  timezone: 'Z',
});

const pool = mysql.createPool({
  ...connectionOptions,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  decimalNumbers: true, // DECIMAL -> number (no strings en el JSON)
});

/**
 * Ejecuta `work(conn)` dentro de una transacción. Hace commit si termina bien
 * y rollback si lanza. Los repositorios aceptan `conn` como último argumento.
 */
async function withTransaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

const closePool = () => pool.end();

const withUserTransaction = (userId, work) =>
  withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT id, currency FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (!rows.length) throw require('../utils/httpError').unauthorized('Sesión inválida');
    const expected = currencyContext.getStore();
    if (expected && expected !== rows[0].currency)
      throw require('../utils/httpError').conflict(
        'La moneda cambió en otra pestaña. Recarga antes de guardar importes.',
      );
    return work(conn);
  });

module.exports = { pool, withTransaction, withUserTransaction, closePool, connectionOptions };
