const request = require('supertest');
const app = require('../server');
const { pgPool, poolPromise } = require('../config/db');
const jwt = require('jsonwebtoken');

jest.mock('../config/db', () => ({
    pgPool: { query: jest.fn(), on: jest.fn(), end: jest.fn() },
    poolPromise: Promise.resolve({ query: jest.fn() })
}));

describe('Messages & Group Chat API Endpoints', () => {
    let mockPool;
    const token = jwt.sign({ user: { id: 1, role: 'user' } }, 'test_secret', { expiresIn: '1h' });

    beforeAll(async () => {
        mockPool = await poolPromise;
        process.env.JWT_SECRET = 'test_secret';
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/messages', () => {
        it('should send a message successfully', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: 10, sender_id: 1, receiver_id: 2, event_id: null, content: 'Hello' }]
            });
            mockPool.query.mockResolvedValueOnce({
                rows: [{ username: 'testuser' }]
            });

            const res = await request(app)
                .post('/api/messages')
                .set('x-auth-token', token)
                .send({ receiver_id: 2, content: 'Hello' });

            expect(res.statusCode).toBe(201);
            expect(res.body.content).toBe('Hello');
            expect(res.body.sender_name).toBe('testuser');
        });

        it('should fail if content is empty', async () => {
            const res = await request(app)
                .post('/api/messages')
                .set('x-auth-token', token)
                .send({ receiver_id: 2, content: '' });

            expect(res.statusCode).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('POST /api/messages/group/:eventId/:timeSlotId', () => {
        it('should allow approved attendee to send group message', async () => {
            // Mock isAttendeeOrCreator middleware checks
            // 1. Not creator
            mockPool.query.mockResolvedValueOnce({ rows: [{ created_by: 999 }] });
            // 2. Is registered attendee
            mockPool.query.mockResolvedValueOnce({ rows: [{ user_id: 1 }] });

            // Mock message insertion
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: 10, event_id: 1, time_slot_id: 1, sender_id: 1, content: 'Group Hello' }]
            });
            // Mock username fetch
            mockPool.query.mockResolvedValueOnce({
                rows: [{ username: 'testuser' }]
            });

            const res = await request(app)
                .post('/api/messages/group/1/1')
                .set('x-auth-token', token)
                .send({ content: 'Group Hello' });

            expect(res.statusCode).toBe(201);
            expect(res.body.content).toBe('Group Hello');
        });

        it('should deny non-attendee from sending group message', async () => {
            // 1. Not creator
            mockPool.query.mockResolvedValueOnce({ rows: [{ created_by: 999 }] });
            // 2. NOT registered attendee (empty rows)
            mockPool.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/messages/group/1/1')
                .set('x-auth-token', token)
                .send({ content: 'Group Hello' });

            expect(res.statusCode).toBe(403);
            expect(res.body.message).toContain('Access denied');
        });
    });
});
