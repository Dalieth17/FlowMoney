// routes/auth.js — registro, login, logout y sesión actual.
const express = require('express');
const bcrypt = require('bcryptjs');
const { pool, seedUserData } = require('../db');
const { issueToken, clearToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    let { name, email, password } = req.body || {};
    name = (name || '').trim();
    email = (email || '').trim().toLowerCase();
    if (name.length < 2) return res.status(400).json({ error: 'Escribe tu nombre' });
    if (!emailRe.test(email)) return res.status(400).json({ error: 'Correo no válido' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    const [exists] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (exists.length) return res.status(409).json({ error: 'Ese correo ya está registrado' });

    const hash = await bcrypt.hash(password, 10);
    const [r] = await pool.query('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)', [name, email, hash]);
    const user = { id: r.insertId, name, email };

    await seedUserData(user.id); // categorías + datos de ejemplo
    issueToken(res, user);
    res.status(201).json({ user });
  } catch (e) { next(e); }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    let { email, password } = req.body || {};
    email = (email || '').trim().toLowerCase();
    if (!email || !password) return res.status(400).json({ error: 'Correo y contraseña requeridos' });

    const [rows] = await pool.query('SELECT id,name,email,password_hash FROM users WHERE email = ?', [email]);
    const u = rows[0];
    if (!u || !(await bcrypt.compare(password, u.password_hash))) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }
    const user = { id: u.id, name: u.name, email: u.email };
    issueToken(res, user);
    res.json({ user });
  } catch (e) { next(e); }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  clearToken(res);
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id,name,email FROM users WHERE id = ?', [req.userId]);
    if (!rows.length) return res.status(401).json({ error: 'No autenticado' });
    res.json({ user: rows[0] });
  } catch (e) { next(e); }
});

module.exports = router;
