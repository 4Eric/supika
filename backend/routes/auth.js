const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { poolPromise } = require('../config/db');
const { sendPasswordResetEmail } = require('../utils/mailer');

const { loginLimiter, registerLimiter } = require('../middlewares/rateLimiter');
const { registerValidation, loginValidation } = require('../middlewares/validator');

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
router.post('/register', registerLimiter, registerValidation, authController.register);

// Login
router.post('/login', loginLimiter, loginValidation, authController.login);

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
