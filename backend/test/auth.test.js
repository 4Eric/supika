const request = require('supertest');
const app = require('../server');
const { pgPool, poolPromise } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock external services to keep tests fast and deterministic
jest.mock('../config/db', () => ({
    pgPool: { query: jest.fn(), on: jest.fn(), end: jest.fn() },
    poolPromise: Promise.resolve({ query: jest.fn() })
}));
jest.mock('../utils/mailer', () => ({
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true)
}));

describe('Auth API Endpoints', () => {
    let mockPool;

    beforeAll(async () => {
        mockPool = await poolPromise;
        process.env.JWT_SECRET = 'test_secret';
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/auth/register', () => {
        const validUser = {
            username: 'testuser',
            email: 'test@supika.app',
            password: 'Password123!',
        };

        it('should register a new user successfully', async () => {
            // Mock DB: insert returning user details
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: 1, username: 'testuser', email: 'test@supika.app', role: 'user' }]
            });

            const res = await request(app)
                .post('/api/auth/register')
                .send(validUser);

            expect(res.statusCode).toBe(201);
            expect(res.body.message).toBe('Registered');
            expect(res.body.user).toHaveProperty('id', 1);
            expect(res.body.user.username).toBe('testuser');
            expect(mockPool.query).toHaveBeenCalledTimes(1);
        });

        it('should fail if email is invalid', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ ...validUser, email: 'not-an-email' });

            // Validation middleware catches it
            expect(res.statusCode).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
            expect(mockPool.query).not.toHaveBeenCalled();
        });

        it('should fail if password is too weak', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ ...validUser, password: 'weak' });

            // Either validator or controller catches it
            expect(res.statusCode).toBe(400);
            expect(res.body).toHaveProperty('message');
        });

        it('should return 400 if user already exists', async () => {
            // Mock Postgres unique constraint error
            const error = new Error('duplicate key');
            error.code = '23505';
            mockPool.query.mockRejectedValueOnce(error);

            const res = await request(app)
                .post('/api/auth/register')
                .send(validUser);

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Exists');
        });
    });

    describe('POST /api/auth/login', () => {
        it('should login successfully with valid credentials', async () => {
            const hashedPassword = await bcrypt.hash('Password123!', 10);

            // Mock finding the user
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: 1, email: 'test@supika.app', password_hash: hashedPassword, role: 'user', username: 'testuser' }]
            });
            // Mock inserting refresh token
            mockPool.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@supika.app', password: 'Password123!' });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('token');
            expect(res.body).toHaveProperty('refreshToken');
            expect(res.body.user).toHaveProperty('id', 1);
        });

        it('should fail with invalid password', async () => {
            const hashedPassword = await bcrypt.hash('Password123!', 10);

            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: 1, email: 'test@supika.app', password_hash: hashedPassword, role: 'user', username: 'testuser' }]
            });

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@supika.app', password: 'WrongPassword' });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Invalid credentials');
        });

        it('should fail if user not found', async () => {
            mockPool.query.mockResolvedValueOnce({ rows: [] }); // No user found

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'nonexistent@supika.app', password: 'Password123!' });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Invalid credentials');
        });
    });

    describe('Protected Route: GET /api/auth/me', () => {
        it('should get current user profile with valid token', async () => {
            const token = jwt.sign({ user: { id: 1, role: 'user' } }, 'test_secret', { expiresIn: '1h' });

            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: 1, username: 'testuser', email: 'test@supika.app', role: 'user' }]
            });

            const res = await request(app)
                .get('/api/auth/me')
                .set('x-auth-token', token);

            expect(res.statusCode).toBe(200);
            expect(res.body.username).toBe('testuser');
        });

        it('should return 401 without token', async () => {
            const res = await request(app).get('/api/auth/me');
            expect(res.statusCode).toBe(401);
            expect(res.body.message).toBe('No token, authorization denied');
        });

        it('should return 401 with invalid token', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set('x-auth-token', 'invalid_token');
            expect(res.statusCode).toBe(401);
            expect(res.body.message).toBe('Token is not valid');
        });
    });
});
