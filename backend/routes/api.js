// routes/api.js — recursos de la app (categorías, movimientos, presupuestos, cuentas).
// Todo requiere sesión y queda acotado al usuario autenticado (req.userId).
const express = require('express');
const { pool, seedUserData } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// ---- mapeos fila DB -> forma del frontend ----
const mapCat = (r) => ({ id: r.id, name: r.name, icon: r.icon, color: r.color, isDefault: !!r.is_default });
const mapTx = (r) => ({ id: r.id, amount: Number(r.amount), description: r.description, date: Number(r.date), type: r.type, categoryId: r.category_id, accountId: r.account_id, note: r.note || '' });
const mapBud = (r) => ({ id: r.id, categoryId: r.category_id, amount: Number(r.amount), month: r.month, year: r.year });
const mapAcc = (r) => ({ id: r.id, name: r.name, type: r.type, initialBalance: Number(r.initial_balance) });

const TYPES = ['INCOME', 'EXPENSE'];
async function ownsCategory(userId, categoryId) {
  const [r] = await pool.query('SELECT id FROM categories WHERE id = ? AND user_id = ?', [categoryId, userId]);
  return r.length > 0;
}

// =================== BOOTSTRAP (carga inicial) ===================
router.get('/bootstrap', async (req, res, next) => {
  try {
    const u = req.userId;
    const [[user]] = await pool.query('SELECT id,name,email FROM users WHERE id = ?', [u]);
    const [cats] = await pool.query('SELECT * FROM categories WHERE user_id = ? ORDER BY id', [u]);
    const [accs] = await pool.query('SELECT * FROM accounts WHERE user_id = ? ORDER BY id', [u]);
    const [txs] = await pool.query('SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC', [u]);
    const [buds] = await pool.query('SELECT * FROM budgets WHERE user_id = ?', [u]);
    res.json({
      user,
      categories: cats.map(mapCat),
      accounts: accs.map(mapAcc),
      transactions: txs.map(mapTx),
      budgets: buds.map(mapBud),
    });
  } catch (e) { next(e); }
});

// =================== CATEGORÍAS ===================
router.post('/categories', async (req, res, next) => {
  try {
    const { name, icon, color } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre requerido' });
    const [r] = await pool.query(
      'INSERT INTO categories (user_id,name,icon,color,is_default) VALUES (?,?,?,?,0)',
      [req.userId, name.trim().slice(0, 40), (icon || '✨').slice(0, 16), (color || '#8A94A6').slice(0, 16)],
    );
    const [[row]] = await pool.query('SELECT * FROM categories WHERE id = ?', [r.insertId]);
    res.status(201).json(mapCat(row));
  } catch (e) { next(e); }
});

router.put('/categories/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!(await ownsCategory(req.userId, id))) return res.status(404).json({ error: 'No encontrada' });
    const { name, icon, color } = req.body || {};
    await pool.query('UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ? AND user_id = ?',
      [(name || '').trim().slice(0, 40), (icon || '✨').slice(0, 16), (color || '#8A94A6').slice(0, 16), id, req.userId]);
    const [[row]] = await pool.query('SELECT * FROM categories WHERE id = ?', [id]);
    res.json(mapCat(row));
  } catch (e) { next(e); }
});

router.delete('/categories/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [[cat]] = await pool.query('SELECT * FROM categories WHERE id = ? AND user_id = ?', [id, req.userId]);
    if (!cat) return res.status(404).json({ error: 'No encontrada' });
    if (cat.is_default) return res.status(409).json({ error: 'No se pueden eliminar las categorías predeterminadas' });
    const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM transactions WHERE category_id = ? AND user_id = ?', [id, req.userId]);
    if (n > 0) return res.status(409).json({ error: 'La categoría tiene movimientos' });
    await pool.query('DELETE FROM categories WHERE id = ? AND user_id = ?', [id, req.userId]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// =================== MOVIMIENTOS ===================
function validTx(b) {
  const amount = Number(b.amount);
  if (!(amount > 0)) return 'El monto debe ser mayor a 0';
  if (!b.description || !b.description.trim()) return 'Descripción requerida';
  if (!TYPES.includes(b.type)) return 'Tipo no válido';
  if (!b.categoryId) return 'Categoría requerida';
  if (!Number.isFinite(Number(b.date))) return 'Fecha no válida';
  return null;
}

router.post('/transactions', async (req, res, next) => {
  try {
    const b = req.body || {};
    const err = validTx(b);
    if (err) return res.status(400).json({ error: err });
    if (!(await ownsCategory(req.userId, b.categoryId))) return res.status(400).json({ error: 'Categoría no válida' });
    const [r] = await pool.query(
      'INSERT INTO transactions (user_id,amount,description,date,type,category_id,account_id,note) VALUES (?,?,?,?,?,?,?,?)',
      [req.userId, Number(b.amount), b.description.trim().slice(0, 120), Number(b.date), b.type, b.categoryId, b.accountId || null, (b.note || '').slice(0, 200)],
    );
    const [[row]] = await pool.query('SELECT * FROM transactions WHERE id = ?', [r.insertId]);
    res.status(201).json(mapTx(row));
  } catch (e) { next(e); }
});

router.put('/transactions/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [[own]] = await pool.query('SELECT id FROM transactions WHERE id = ? AND user_id = ?', [id, req.userId]);
    if (!own) return res.status(404).json({ error: 'No encontrado' });
    const b = req.body || {};
    const err = validTx(b);
    if (err) return res.status(400).json({ error: err });
    if (!(await ownsCategory(req.userId, b.categoryId))) return res.status(400).json({ error: 'Categoría no válida' });
    await pool.query(
      'UPDATE transactions SET amount=?,description=?,date=?,type=?,category_id=?,account_id=?,note=? WHERE id=? AND user_id=?',
      [Number(b.amount), b.description.trim().slice(0, 120), Number(b.date), b.type, b.categoryId, b.accountId || null, (b.note || '').slice(0, 200), id, req.userId],
    );
    const [[row]] = await pool.query('SELECT * FROM transactions WHERE id = ?', [id]);
    res.json(mapTx(row));
  } catch (e) { next(e); }
});

router.delete('/transactions/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [r] = await pool.query('DELETE FROM transactions WHERE id = ? AND user_id = ?', [id, req.userId]);
    if (!r.affectedRows) return res.status(404).json({ error: 'No encontrado' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// =================== PRESUPUESTOS (upsert por categoría/mes/año) ===================
router.put('/budgets', async (req, res, next) => {
  try {
    const { categoryId, month, year, amount } = req.body || {};
    if (!categoryId || month == null || year == null) return res.status(400).json({ error: 'Datos incompletos' });
    if (!(await ownsCategory(req.userId, categoryId))) return res.status(400).json({ error: 'Categoría no válida' });
    const amt = Number(amount) || 0;
    if (amt <= 0) {
      await pool.query('DELETE FROM budgets WHERE user_id=? AND category_id=? AND month=? AND year=?', [req.userId, categoryId, month, year]);
      return res.json({ removed: true });
    }
    await pool.query(
      `INSERT INTO budgets (user_id,category_id,amount,month,year) VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
      [req.userId, categoryId, amt, month, year],
    );
    const [[row]] = await pool.query('SELECT * FROM budgets WHERE user_id=? AND category_id=? AND month=? AND year=?', [req.userId, categoryId, month, year]);
    res.json(mapBud(row));
  } catch (e) { next(e); }
});

// =================== DATOS: reiniciar / limpiar ===================
router.post('/data/reset', async (req, res, next) => {
  try {
    const u = req.userId;
    await pool.query('DELETE FROM transactions WHERE user_id = ?', [u]);
    await pool.query('DELETE FROM budgets WHERE user_id = ?', [u]);
    await pool.query('DELETE FROM categories WHERE user_id = ?', [u]);
    await pool.query('DELETE FROM accounts WHERE user_id = ?', [u]);
    await seedUserData(u);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
