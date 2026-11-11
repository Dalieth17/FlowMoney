// Router raíz de /api. Las rutas públicas van antes de requireAuth.
const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const asyncHandler = require('../utils/asyncHandler');
const crudRouter = require('./crudRouter');
const authRoutes = require('./auth.routes');
const profileRoutes = require('./profile.routes');
const budgetRoutes = require('./budgets.routes');
const dataService = require('../services/dataService');
const categoryService = require('../services/categoryService');
const accountService = require('../services/accountService');
const transactionService = require('../services/transactionService');
const { categorySchema, accountSchema, transactionSchema } = require('../validation/schemas');

function buildApiRouter() {
  const router = express.Router();

  // ---- Públicas ----
  router.get('/health', (req, res) => res.json({ ok: true }));
  router.use('/auth', authRoutes);

  // ---- Privadas ----
  router.use(requireAuth);
  router.get(
    '/bootstrap',
    asyncHandler(async (req, res) => {
      res.json(await dataService.bootstrap(req.userId));
    }),
  );
  router.post(
    '/data/reset',
    asyncHandler(async (req, res) => {
      await dataService.resetToSample(req.userId);
      res.status(204).end();
    }),
  );
  router.use('/profile', profileRoutes);
  router.use('/budgets', budgetRoutes);
  router.use('/categories', crudRouter(categoryService, categorySchema));
  router.use('/accounts', crudRouter(accountService, accountSchema));
  router.use('/transactions', crudRouter(transactionService, transactionSchema));

  return router;
}

module.exports = buildApiRouter;
