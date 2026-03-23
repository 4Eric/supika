const express = require('express');
const router = express.Router();
const { createCheckoutSession, handleWebhook, getTransactionStatus, createRefund } = require('../controllers/paymentController');
const auth = require('../utils/auth');

// Webhook must be first and use raw body (configured in server.js)
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Protected routes
router.post('/checkout', auth, createCheckoutSession);
router.get('/status/:sessionId', auth, getTransactionStatus);
router.post('/refund', auth, createRefund);

module.exports = router;
