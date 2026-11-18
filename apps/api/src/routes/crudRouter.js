// Fábrica de routers CRUD para recursos del usuario con la misma forma
// (list/create/update/remove). Evita repetir handlers idénticos.
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { idParamSchema } = require('../validation/schemas');

function crudRouter(service, schema) {
  const router = express.Router();
  const withId = validate(idParamSchema, 'params');

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      res.json(await service.list(req.userId));
    }),
  );

  router.post(
    '/',
    validate(schema),
    asyncHandler(async (req, res) => {
      res.status(201).json(await service.create(req.userId, req.valid.body));
    }),
  );

  router.put(
    '/:id',
    withId,
    validate(schema),
    asyncHandler(async (req, res) => {
      res.json(await service.update(req.userId, req.valid.params.id, req.valid.body));
    }),
  );

  router.delete(
    '/:id',
    withId,
    asyncHandler(async (req, res) => {
      await service.remove(req.userId, req.valid.params.id);
      res.status(204).end();
    }),
  );

  return router;
}

module.exports = crudRouter;
