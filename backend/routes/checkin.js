const express = require('express');
const router = express.Router();
const { checkInByToken, manualCheckIn } = require('../controllers/checkinController');
const auth = require('../utils/auth');
const { isEventHost } = require('../middlewares/accessControl');

// All check-in routes require authentication (as the host)
// All check-in routes require authentication (as the host)
router.post('/:id/check-in', [auth, isEventHost], checkInByToken);
router.post('/:id/check-in/manual/:userId', [auth, isEventHost], manualCheckIn);

module.exports = router;
