const express = require('express');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/transactionImportService');
const { input, confirmation } = require('../validation/transactionImportSchemas');
const router = express.Router();
router.post(
  '/preview',
  validate(input),
  asyncHandler(async (req, res) => res.json(await service.preview(req.userId, req.valid.body))),
);
router.post(
  '/',
  validate(confirmation),
  asyncHandler(async (req, res) => res.json(await service.commit(req.userId, req.valid.body))),
);
module.exports = router;
