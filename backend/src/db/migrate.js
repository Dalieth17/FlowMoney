// Migraciones versionadas: aplica en orden los .sql de ./migrations que aún
// no estén registrados en la tabla schema_migrations. Idempotente.
const fs = require('node:fs/promises');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { connectionOptions } = require('./pool');
const logger = require('../utils/logger');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Espera a que MySQL acepte conexiones (el contenedor tarda en arrancar). */
async function waitForDatabase({ retries = 30, delayMs = 2000 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await mysql.createConnection(connectionOptions);
      await conn.ping();
      await conn.end();
      return;
    } catch (err) {
      logger.warn(`MySQL no disponible (${attempt}/${retries}): ${err.code || err.message}`);
      await sleep(delayMs);
    }
  }
  throw new Error('No se pudo conectar a MySQL');
}

async function runMigrations() {
  const conn = await mysql.createConnection({ ...connectionOptions, multipleStatements: true });
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    VARCHAR(100) PRIMARY KEY,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    const [rows] = await conn.query('SELECT version FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.version));

    const files = (await fs.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      logger.info(`Aplicando migración ${file}`);
      await conn.query(sql);
      await conn.query('INSERT INTO schema_migrations (version) VALUES (?)', [file]);
    }
    logger.info('Esquema de base de datos al día');
  } finally {
    await conn.end();
  }
}

module.exports = { waitForDatabase, runMigrations };
