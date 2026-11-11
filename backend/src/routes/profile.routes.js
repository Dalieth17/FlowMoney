// /api/profile — ver y editar el perfil, cambiar contraseña.
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { profileSchema, changePasswordSchema } = require('../validation/schemas');
const profileService = require('../services/profileService');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await profileService.getProfile(req.userId));
  }),
);

router.put(
  '/',
  validate(profileSchema),
  asyncHandler(async (req, res) => {
    res.json(await profileService.updateProfile(req.userId, req.valid.body));
  }),
);

router.put(
  '/password',
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    await profileService.changePassword(req.userId, req.valid.body);
    res.status(204).end();
  }),
);

module.exports = router;
