// Punto de entrada: espera a MySQL, aplica migraciones y levanta la API.
const config = require('./config');
const logger = require('./utils/logger');
const createApp = require('./app');
const { waitForDatabase, runMigrations } = require('./db/migrate');
const { closePool } = require('./db/pool');

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function start() {
  if (config.auth.jwtSecretIsEphemeral) {
    logger.warn('JWT_SECRET no definido: se generó uno temporal. Las sesiones se cerrarán al reiniciar.');
  }

  await waitForDatabase();
  await runMigrations();

  const server = createApp().listen(config.port, () => {
    logger.info(`FlowMoney API escuchando en :${config.port} (${config.env})`);
  });

  // Apagado ordenado: dejamos terminar las peticiones en curso y cerramos el pool.
  const shutdown = (signal) => {
    logger.info(`${signal} recibido, cerrando…`);
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err) => {
  logger.error('No se pudo iniciar la API:', err);
  process.exit(1);
});
