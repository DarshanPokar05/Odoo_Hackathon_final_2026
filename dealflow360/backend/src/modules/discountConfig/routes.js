'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const ctrl = require('./controller');

const readRoles  = ['ADMIN', 'FINANCE', 'SALES_MANAGER'];
const writeRoles = ['ADMIN'];

// ── Specific named routes MUST come before /:id wildcards ─────────────────────

// Tier discount ceilings
router.get('/ceilings',        requireAuth, requireRole(...readRoles),  ctrl.listCeilings);
router.put('/ceilings/:tier',  requireAuth, requireRole(...writeRoles), ctrl.updateCeiling);

// Approval chain rules
router.get('/approval-rules',  requireAuth, requireRole(...readRoles),  ctrl.listApprovalRules);
router.put('/approval-rules',  requireAuth, requireRole(...writeRoles), ctrl.saveApprovalRules);

// ── Generic fallback routes (/:id wildcard — must be LAST) ────────────────────
router.get('/',       requireAuth, requireRole(...readRoles),  ctrl.list);
router.post('/',      requireAuth, requireRole(...writeRoles), ctrl.create);
router.get('/:id',    requireAuth, requireRole(...readRoles),  ctrl.getOne);
router.put('/:id',    requireAuth, requireRole(...writeRoles), ctrl.update);
router.delete('/:id', requireAuth, requireRole(...writeRoles), ctrl.remove);

module.exports = router;
