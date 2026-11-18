const express = require('express');
const { z } = require('zod');
const wrap = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');
const schema = require('../validation/financeSchemas');
const { idParamSchema } = require('../validation/schemas');
const service = require('../services/financeService');
const backup = require('../services/backupService');
const router = express.Router();
router.get(
  '/',
  wrap(async (req, res) => res.json(await service.state(req.userId))),
);
router.post(
  '/transfers/:id',
  validate(schema.uuidParam, 'params'),
  validate(schema.transfer),
  wrap(async (req, res) =>
    res.status(201).json(await service.transfer(req.userId, req.valid.params.id, req.valid.body)),
  ),
);
router.put(
  '/transfers/:id',
  validate(schema.uuidParam, 'params'),
  validate(schema.transfer),
  wrap(async (req, res) => res.json(await service.transfer(req.userId, req.valid.params.id, req.valid.body, true))),
);
router.delete(
  '/transfers/:id',
  validate(schema.uuidParam, 'params'),
  wrap(async (req, res) => {
    await service.removeTransfer(req.userId, req.valid.params.id);
    res.status(204).end();
  }),
);
router.post(
  '/reconciliations/:id',
  validate(schema.uuidParam, 'params'),
  validate(schema.reconciliation),
  wrap(async (req, res) => res.json(await service.reconcile(req.userId, req.valid.params.id, req.valid.body))),
);
router.post(
  '/schedules',
  validate(schema.schedule),
  wrap(async (req, res) => res.status(201).json(await service.saveSchedule(req.userId, null, req.valid.body))),
);
router.put(
  '/schedules/:id',
  validate(idParamSchema, 'params'),
  validate(schema.schedule),
  wrap(async (req, res) => res.json(await service.saveSchedule(req.userId, req.valid.params.id, req.valid.body))),
);
router.post(
  '/schedules/run',
  wrap(async (req, res) => res.json(await service.runSchedules(req.userId))),
);
router.get(
  '/backup',
  wrap(async (req, res) => res.json(await backup.exportData(req.userId))),
);
router.post(
  '/backup/preview',
  wrap(async (req, res) => res.json(backup.preview(req.body))),
);
router.post(
  '/backup/restore',
  authLimiter,
  validate(z.object({ backup: z.unknown(), digest: z.string().length(64), password: z.string().min(1).max(128) })),
  wrap(async (req, res) =>
    res.json(await backup.restore(req.userId, req.valid.body.backup, req.valid.body.digest, req.valid.body.password)),
  ),
);
module.exports = router;
