const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { poolPromise } = require('../config/db');
const { mapToCamelCase } = require('../utils/mapper');
const { sendPasswordResetEmail } = require('../utils/mailer');

const register = async (req, res) => {
    try {
        const { username, email, password, role } = req.body;
        const pool = await poolPromise;
        if (!password || password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*()]/.test(password)) {
            return res.status(400).json({ message: 'Password too weak' });
        }
        let assignedRole = 'user';
        if (role === 'admin') {
            const token = req.header('x-auth-token');
            if (token) {
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
                    if (decoded.user.role === 'admin') assignedRole = 'admin';
                } catch (e) { }
            }
        } else if (role) assignedRole = role;

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const result = await pool.query('INSERT INTO "Users" (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role', [username, email, hashedPassword, assignedRole]);
        res.status(201).json({ message: 'Registered', user: mapToCamelCase(result.rows[0]) });
    } catch (error) {
        if (error.code === '23505') return res.status(400).json({ message: 'Exists' });
        console.error(error); res.status(500).json({ message: 'Error' });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const pool = await poolPromise;
        const result = await pool.query('SELECT * FROM "Users" WHERE email = $1', [email]);
        const user = result.rows[0];
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        const payload = { user: { id: user.id, role: user.role } };
        const secret = process.env.JWT_SECRET || 'secret';

        const token = await new Promise((resolve, reject) => {
            jwt.sign(payload, secret, { expiresIn: '1h' }, (err, token) => {
                if (err) reject(err);
                else resolve(token);
            });
        });

        const refreshToken = crypto.randomBytes(64).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await pool.query('INSERT INTO "RefreshTokens" (user_id, token, expires_at) VALUES ($1, $2, $3)', [user.id, refreshToken, expiresAt]);

        res.json({
            token,
            refreshToken,
            user: mapToCamelCase({ id: user.id, username: user.username, email: user.email, role: user.role })
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error during login' });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const pool = await poolPromise;
        const check = await pool.query('SELECT id FROM "Users" WHERE (username = $1 OR email = $2) AND id != $3', [username, email, req.user.id]);
        if (check.rows.length > 0) return res.status(400).json({ message: 'In use' });
        let sql = 'UPDATE "Users" SET username = $1, email = $2', params = [username, email];
        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            const hashed = await bcrypt.hash(password, salt);
            sql += `, password_hash = $3`; params.push(hashed);
        }
        sql += ` WHERE id = $${params.length + 1} RETURNING id, username, email, role`;
        params.push(req.user.id);
        const result = await pool.query(sql, params);
        res.json(mapToCamelCase(result.rows[0]));
    } catch (e) { console.error(e); res.status(500).json({ message: 'Error' }); }
};

const refreshToken = async (req, res) => {
    try {
        const { refreshToken: rToken } = req.body;
        if (!rToken) return res.status(400).json({ message: 'Required' });
        const pool = await poolPromise;
        const result = await pool.query('SELECT * FROM "RefreshTokens" WHERE token = $1 AND expires_at > NOW()', [rToken]);
        if (result.rows.length === 0) return res.status(401).json({ message: 'Expired' });
        const userRes = await pool.query('SELECT id, role FROM "Users" WHERE id = $1', [result.rows[0].user_id]);
        if (userRes.rows.length === 0) return res.status(401).json({ message: 'Not found' });
        const payload = { user: { id: userRes.rows[0].id, role: userRes.rows[0].role } };
        const secret = process.env.JWT_SECRET || 'secret';

        const token = await new Promise((resolve, reject) => {
            jwt.sign(payload, secret, { expiresIn: '1h' }, (err, token) => {
                if (err) reject(err);
                else resolve(token);
            });
        });

        res.json({ token });
    } catch (e) {
        console.error('Refresh token error:', e);
        res.status(500).json({ message: 'Internal server error during token refresh' });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const pool = await poolPromise;
        const result = await pool.query('SELECT id FROM "Users" WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.json({ message: 'Sent' });
        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(); expiry.setHours(expiry.getHours() + 1);
        await pool.query('UPDATE "Users" SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3', [token, expiry, result.rows[0].id]);
        await sendPasswordResetEmail(email, token);
        res.json({ message: 'Sent' });
    } catch (e) { console.error(e); res.status(500).json({ message: 'Error' }); }
};

const resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;
        const pool = await poolPromise;
        const result = await pool.query('SELECT id FROM "Users" WHERE reset_password_token = $1 AND reset_password_expires > NOW()', [token]);
        if (result.rows.length === 0) return res.status(400).json({ message: 'Invalid token' });
        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(password, salt);
        await pool.query('UPDATE "Users" SET password_hash = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2', [hashed, result.rows[0].id]);
        res.json({ message: 'Reset' });
    } catch (e) { console.error(e); res.status(500).json({ message: 'Error' }); }
};

const adminGetUsers = async (req, res) => {
    try {
        const { search } = req.query;
        const pool = await poolPromise;
        let sql = 'SELECT id, username, email, role, created_at FROM "Users"', params = [];
        if (search) { sql += ' WHERE username ILIKE $1 OR email ILIKE $1'; params.push(`%${search}%`); }
        sql += ' ORDER BY created_at DESC';
        const result = await pool.query(sql, params);
        res.json(mapToCamelCase(result.rows));
    } catch (e) { console.error(e); res.status(500).json({ message: 'Error' }); }
};

const adminUpdateUser = async (req, res) => {
    try {
        const { id } = req.params; const { username, email, role, password } = req.body;
        const pool = await poolPromise;
        const check = await pool.query('SELECT id FROM "Users" WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ message: 'Not found' });
        let sql = 'UPDATE "Users" SET username = $1, email = $2, role = $3', params = [username, email, role];
        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10); const hashed = await bcrypt.hash(password, salt);
            sql += `, password_hash = $4`; params.push(hashed);
        }
        sql += ` WHERE id = $${params.length + 1} RETURNING id, username, email, role`;
        params.push(id);
        const result = await pool.query(sql, params);
        res.json(mapToCamelCase(result.rows[0]));
    } catch (e) { if (e.code === '23505') return res.status(400).json({ message: 'In use' }); console.error(e); res.status(500).json({ message: 'Error' }); }
};

const adminDeleteUser = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.query('DELETE FROM "Users" WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Not found' });
        res.json({ message: 'Deleted' });
    } catch (e) { console.error(e); res.status(500).json({ message: 'Error' }); }
};

const getCurrentUser = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.query('SELECT id, username, email, role FROM "Users" WHERE id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
        res.json(mapToCamelCase(result.rows[0]));
    } catch (error) { console.error(error); res.status(500).json({ message: 'Error' }); }
};

const logout = async (req, res) => {
    try {
        const { refreshToken: rt } = req.body;
        if (rt) {
            const pool = await poolPromise;
            await pool.query('DELETE FROM "RefreshTokens" WHERE token = $1 AND user_id = $2', [rt, req.user.id]);
        }
        res.json({ message: 'Logged out' });
    } catch (e) { console.error(e); res.status(500).json({ message: 'Error' }); }
};

module.exports = {
    register, login, getCurrentUser, updateProfile, refreshToken, logout, forgotPassword, resetPassword, adminGetUsers, adminUpdateUser, adminDeleteUser
};
