const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const auth = require('../utils/auth');

// All AI routes require authentication + admin role
const { aiDiscoverLimiter } = require('../middlewares/rateLimiter');
const adminOnly = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

router.post('/discover', auth, adminOnly, aiDiscoverLimiter, aiController.discover);
router.post('/approve', auth, adminOnly, aiController.approve);
router.get('/discoveries', auth, adminOnly, aiController.listDiscoveries);

module.exports = router;
