// /api/budgets — listar y definir el límite de una categoría en un mes.
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { budgetSchema } = require('../validation/schemas');
const budgetService = require('../services/budgetService');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await budgetService.list(req.userId));
  }),
);

// Upsert: 200 con el presupuesto, o 204 si el monto era 0 y se eliminó.
router.put(
  '/',
  validate(budgetSchema),
  asyncHandler(async (req, res) => {
    const budget = await budgetService.set(req.userId, req.valid.body);
    if (budget) res.json(budget);
    else res.status(204).end();
  }),
);

module.exports = router;
