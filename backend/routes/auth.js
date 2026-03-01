const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { poolPromise } = require('../config/db');
const { sendPasswordResetEmail } = require('../utils/mailer');

// Rate limiters for auth endpoints
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 attempts per window
    message: { message: 'Too many login attempts, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
});

const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // 10 registrations per window
    message: { message: 'Too many accounts created, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Middleware to protect routes
const auth = require('../utils/auth');
const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }
};

const authController = require('../controllers/authController');

// Register
router.post('/register', registerLimiter, authController.register);

// Login
router.post('/login', loginLimiter, authController.login);

// Get Current User Profile
router.get('/me', auth, authController.getCurrentUser);

// Update Current User Profile
router.put('/me', auth, authController.updateProfile);

// Refresh Token
router.post('/refresh-token', authController.refreshToken);

// Logout
router.post('/logout', auth, authController.logout);

// Forgot Password - Request Reset
router.post('/forgot-password', authController.forgotPassword);

// Reset Password - Verify & Update
router.post('/reset-password', authController.resetPassword);

// --- ADMIN ENDPOINTS ---

// Get All Users (Admin Only)
router.get('/admin/users', [auth, adminOnly], authController.adminGetUsers);

// Update Any User (Admin Only)
router.put('/admin/users/:id', [auth, adminOnly], authController.adminUpdateUser);

// Delete User (Admin Only)
router.delete('/admin/users/:id', [auth, adminOnly], authController.adminDeleteUser);

module.exports = router;

module.exports = router;
