'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const ctrl   = require('./controller');

// Public routes — no auth required
router.post('/signup',          ctrl.signup);
router.post('/login',           ctrl.login);
router.post('/change-password', ctrl.changePassword);

// Protected route — needs a valid JWT
router.get('/me', requireAuth, ctrl.me);

module.exports = router;
