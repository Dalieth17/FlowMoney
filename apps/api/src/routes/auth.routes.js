// /api/auth — registro, login, logout y usuario actual.
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const requireAuth = require('../middleware/requireAuth');
const { authLimiter } = require('../middleware/rateLimiter');
const { registerSchema, loginSchema } = require('../validation/schemas');
const { setSessionCookie, endSession } = require('../services/sessionService');
const authService = require('../services/authService');
const profileService = require('../services/profileService');

const router = express.Router();

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
