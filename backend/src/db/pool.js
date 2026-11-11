// Pool de conexiones MySQL + helper de transacciones.
const mysql = require('mysql2/promise');
const config = require('../config');

const connectionOptions = Object.freeze({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
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

module.exports = { pool, withTransaction, closePool, connectionOptions };
