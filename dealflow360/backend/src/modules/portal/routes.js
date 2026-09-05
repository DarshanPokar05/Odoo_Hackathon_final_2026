'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const ctrl = require('./controller');

// TODO: implement full routes in the relevant phase
router.get('/',    requireAuth, requireRole('CUSTOMER'), ctrl.list);
router.get('/:id', requireAuth, requireRole('CUSTOMER'), ctrl.getOne);
router.post('/',   requireAuth, requireRole('CUSTOMER'), ctrl.create);
router.put('/:id', requireAuth, requireRole('CUSTOMER'), ctrl.update);
router.delete('/:id', requireAuth, requireRole('CUSTOMER'), ctrl.remove);

module.exports = router;
