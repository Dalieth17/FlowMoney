// /api/profile — ver y editar el perfil, cambiar contraseña y eliminar la cuenta.
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { profileSchema, changePasswordSchema, deleteAccountSchema } = require('../validation/schemas');
const profileService = require('../services/profileService');
const { startSession, endSession } = require('../services/sessionService');

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
    // Todas las sesiones se revocaron; este dispositivo sigue dentro con una sesión nueva.
    await startSession(res, req.userId);
    res.status(204).end();
  }),
);

router.delete(
  '/',
  validate(deleteAccountSchema),
  asyncHandler(async (req, res) => {
    await profileService.deleteAccount(req.userId, req.valid.body);
    // Las sesiones ya se borraron con el usuario: solo queda limpiar la cookie.
    await endSession(req, res);
    res.status(204).end();
  }),
);

module.exports = router;
