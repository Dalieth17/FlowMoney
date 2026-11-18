const router = require('express').Router();
const wrap = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const s = require('../validation/goalSchemas');
const service = require('../services/goalService');
router.get(
  '/',
  wrap(async (req, res) => res.json(await service.list(req.userId))),
);
router.post(
  '/:id',
  validate(s.params, 'params'),
  validate(s.goal),
  wrap(async (req, res) => res.status(201).json(await service.save(req.userId, req.valid.params.id, req.valid.body))),
);
router.put(
  '/:id',
  validate(s.params, 'params'),
  validate(s.goal),
  wrap(async (req, res) => res.json(await service.save(req.userId, req.valid.params.id, req.valid.body, true))),
);
router.post(
  '/:id/entries/:entryId',
  validate(s.entryParams, 'params'),
  validate(s.entry),
  wrap(async (req, res) =>
    res.status(201).json(await service.add(req.userId, req.valid.params.id, req.valid.params.entryId, req.valid.body)),
  ),
);
router.delete(
  '/:id/entries/:entryId',
  validate(s.entryParams, 'params'),
  wrap(async (req, res) => {
    await service.removeEntry(req.userId, req.valid.params.id, req.valid.params.entryId);
    res.status(204).end();
  }),
);
module.exports = router;
