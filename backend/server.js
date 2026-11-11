// server.js — API REST de FlowMoney (Express + MySQL).
const express = require('express');
const cookieParser = require('cookie-parser');
const { init } = require('./db');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());

// Salud (para healthcheck de Docker)
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

// 404 para rutas /api desconocidas
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Manejador de errores central
app.use((err, req, res, next) => {
  console.error('[api] error:', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = Number(process.env.PORT || 3000);

init()
  .then(() => app.listen(PORT, () => console.log(`[api] FlowMoney API escuchando en :${PORT}`)))
  .catch((e) => { console.error('[api] no se pudo iniciar:', e.message); process.exit(1); });
