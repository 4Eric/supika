const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Public profile & user-specific event feeds
router.get('/:id/public', userController.getPublicProfile);
router.get('/:id/events', userController.getUserEvents);

module.exports = router;
