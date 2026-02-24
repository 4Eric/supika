const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { poolPromise } = require('../config/db');

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
const auth = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        req.user = decoded.user;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

// Middleware to check for Admin role
const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }
};

// Register
router.post('/register', registerLimiter, async (req, res) => {
    try {
        const { username, email, password, role } = req.body;
        const pool = await poolPromise;

        // Password strength validation
        if (!password || password.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters long' });
        }
        if (!/[A-Z]/.test(password)) {
            return res.status(400).json({ message: 'Password must contain at least one uppercase letter' });
        }
        if (!/[a-z]/.test(password)) {
            return res.status(400).json({ message: 'Password must contain at least one lowercase letter' });
        }
        if (!/[0-9]/.test(password)) {
            return res.status(400).json({ message: 'Password must contain at least one number' });
        }
        if (!/[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?/\\`~]/.test(password)) {
            return res.status(400).json({ message: 'Password must contain at least one special character' });
        }        // Security: Prevent self-assignment of admin role
        let assignedRole = 'user';
        if (role === 'admin') {
            // Check if requester is already an admin
            const token = req.header('x-auth-token');
            if (token) {
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
                    if (decoded.user.role === 'admin') {
                        assignedRole = 'admin';
                    }
                } catch (err) {
                    // Ignore token errors and stick with 'user'
                }
            }
        } else if (role) {
            assignedRole = role; // allow other roles like 'creator' or 'organizer' if they exist
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const result = await pool.query(`
            INSERT INTO "Users" (username, email, password_hash, role) 
            VALUES ($1, $2, $3, $4)
            RETURNING id, username, email, role
        `, [username, email, hashedPassword, assignedRole]);

        res.status(201).json({ message: 'User registered successfully', user: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') { // Postgres Unique Violation
            return res.status(400).json({ message: 'Username or email already exists' });
        }
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        const pool = await poolPromise;

        const result = await pool.query('SELECT * FROM "Users" WHERE email = $1', [email]);

        const user = result.rows[0];
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' }, (err, token) => {
            if (err) throw err;
            res.json({ token, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get Current User Profile
router.get('/me', auth, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.query('SELECT id, username, email, role FROM "Users" WHERE id = $1', [req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update Current User Profile
router.put('/me', auth, async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const pool = await poolPromise;
        const userId = req.user.id;

        // Verify username/email doesn't belong to someone else
        const checkResult = await pool.query(
            'SELECT id FROM "Users" WHERE (username = $1 OR email = $2) AND id != $3',
            [username, email, userId]
        );

        if (checkResult.rows.length > 0) {
            return res.status(400).json({ message: 'Username or email already in use by another account.' });
        }

        let queryStr = 'UPDATE "Users" SET username = $1, email = $2';
        const queryParams = [username, email];
        let paramIndex = 3;

        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            queryStr += `, password_hash = $${paramIndex}`;
            queryParams.push(hashedPassword);
            paramIndex++;
        }

        queryStr += ` WHERE id = $${paramIndex} RETURNING id, username, email, role`;
        queryParams.push(userId);

        const updateResult = await pool.query(queryStr, queryParams);
        res.json(updateResult.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error updating profile' });
    }
});

// --- ADMIN ENDPOINTS ---

// Get All Users (Admin Only)
router.get('/admin/users', [auth, adminOnly], async (req, res) => {
    try {
        const { search } = req.query;
        const pool = await poolPromise;

        let queryStr = 'SELECT id, username, email, role, created_at FROM "Users"';
        const queryParams = [];

        if (search) {
            queryStr += ' WHERE username ILIKE $1 OR email ILIKE $1';
            queryParams.push(`%${search}%`);
        }

        queryStr += ' ORDER BY created_at DESC';

        const result = await pool.query(queryStr, queryParams);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching users' });
    }
});

// Update Any User (Admin Only)
router.put('/admin/users/:id', [auth, adminOnly], async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email, role, password } = req.body;
        const pool = await poolPromise;

        // Check if user exists
        const userCheck = await pool.query('SELECT id FROM "Users" WHERE id = $1', [id]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        let queryStr = 'UPDATE "Users" SET username = $1, email = $2, role = $3';
        const queryParams = [username, email, role];
        let paramIndex = 4;

        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            queryStr += `, password_hash = $${paramIndex}`;
            queryParams.push(hashedPassword);
            paramIndex++;
        }

        queryStr += ` WHERE id = $${paramIndex} RETURNING id, username, email, role`;
        queryParams.push(id);

        const result = await pool.query(queryStr, queryParams);
        res.json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ message: 'Username or email already in use.' });
        }
        console.error(error);
        res.status(500).json({ message: 'Server error updating user' });
    }
});

// Delete User (Admin Only)
router.delete('/admin/users/:id', [auth, adminOnly], async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await poolPromise;

        const result = await pool.query('DELETE FROM "Users" WHERE id = $1 RETURNING id', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error deleting user' });
    }
});

module.exports = router;
