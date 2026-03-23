const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../utils/auth');

// Public profile & user-specific event feeds
router.get('/:id/public', userController.getPublicProfile);
router.get('/:id/events', userController.getUserEvents);

// Follow logic
router.post('/:id/follow', auth, userController.followUser);
router.delete('/:id/unfollow', auth, userController.unfollowUser);
router.get('/:id/followers', userController.getFollowers);

module.exports = router;
