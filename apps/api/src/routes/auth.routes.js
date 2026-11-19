// /api/auth — registro, login, logout y usuario actual.
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const requireAuth = require('../middleware/requireAuth');
const { authLimiter, recoveryLimiter } = require('../middleware/rateLimiter');
const { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } = require('../validation/schemas');
const passwordReset = require('../services/passwordResetService');
const { setSessionCookie, endSession } = require('../services/sessionService');
const authService = require('../services/authService');
const profileService = require('../services/profileService');

const router = express.Router();

router.post(
  '/forgot-password',
  recoveryLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    res.status(202).json(await passwordReset.requestReset(req.valid.body.email));
  }),
);
router.post(
  '/reset-password',
  recoveryLimiter,
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const result = await passwordReset.resetPassword(req.valid.body.token, req.valid.body.password);
    await endSession(req, res);
    res.json(result);
  }),
);

router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { user, token } = await authService.register(req.valid.body);
    setSessionCookie(res, token);
    res.status(201).json({ user });
  }),
);

router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { user, token } = await authService.login(req.valid.body);
    setSessionCookie(res, token);
    res.json({ user });
  }),
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await endSession(req, res);
    res.status(204).end();
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: await profileService.getProfile(req.userId) });
  }),
);

module.exports = router;
