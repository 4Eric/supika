const request = require('supertest');
const app = require('../server');
const { pgPool, poolPromise } = require('../config/db');
const jwt = require('jsonwebtoken');

// Mock external dependencies
jest.mock('../config/db', () => ({
    pgPool: { query: jest.fn(), on: jest.fn(), end: jest.fn() },
    poolPromise: Promise.resolve({ query: jest.fn() })
}));

jest.mock('cloudinary', () => ({
    v2: {
        config: jest.fn(),
        uploader: { upload: jest.fn().mockResolvedValue({ secure_url: 'http://res.cloudinary.com/test.jpg' }) }
    }
}));

describe('Events API Endpoints', () => {
    let mockPool;
    const token = jwt.sign({ user: { id: 1, role: 'user' } }, 'test_secret', { expiresIn: '1h' });
    const adminToken = jwt.sign({ user: { id: 2, role: 'admin' } }, 'test_secret', { expiresIn: '1h' });

    beforeAll(async () => {
        mockPool = await poolPromise;
        process.env.JWT_SECRET = 'test_secret';
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/events', () => {
        it('should get all public, approved events', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: 10, title: 'Test Event', isPrivate: false, requiresApproval: false }],
                rowCount: 1
            });
            mockPool.query.mockResolvedValueOnce({ rows: [{ count: 1 }] });

            const res = await request(app).get('/api/events');

            expect(res.statusCode).toBe(200);
            expect(res.body.events).toHaveLength(1);
            expect(res.body.events[0].title).toBe('Test Event');
        });
    });

    describe('POST /api/events', () => {
        const validEvent = {
            title: 'My Cool Party',
            description: 'A very cool party',
            latitude: 40.7128,
            longitude: -74.0060,
            locationName: 'NYC',
            timeSlots: JSON.stringify([{ start_time: new Date().toISOString(), end_time: new Date().toISOString(), capacity: 10 }])
        };

        it('should fail without auth token', async () => {
            const res = await request(app).post('/api/events').send(validEvent);
            expect(res.statusCode).toBe(401);
        });

        it('should fail with invalid latitude', async () => {
            const res = await request(app)
                .post('/api/events')
                .set('x-auth-token', token)
                .send({ ...validEvent, latitude: 150 });

            // Validation error
            expect(res.statusCode).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });

        it('should create an event successfully', async () => {
            // Mock transaction begin
            mockPool.query.mockResolvedValueOnce({});
            // Mock insert event
            mockPool.query.mockResolvedValueOnce({ rows: [{ id: 99 }] });
            // Mock loop over time slots (1 slot)
            mockPool.query.mockResolvedValueOnce({});
            // Mock transaction commit
            mockPool.query.mockResolvedValueOnce({});

            const res = await request(app)
                .post('/api/events')
                .set('x-auth-token', token)
                .send(validEvent);

            expect(res.statusCode).toBe(201);
            expect(res.body.message).toBe('Event created successfully');
        });
    });

    describe('PUT /api/events/:id', () => {
        it('should fail if user does not own the event', async () => {
            // Mock finding the event, owned by user 999
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: 1, created_by: 999 }]
            });

            const res = await request(app)
                .put('/api/events/1')
                .set('x-auth-token', token)
                .send({ title: 'Hacked' });

            expect(res.statusCode).toBe(403);
            expect(res.body.message).toBe('Unauthorized to edit this event');
        });
    });

    describe('DELETE /api/events/:id', () => {
        it('should delete event successfully if owned by user', async () => {
            // Mock finding the event (owned by 1)
            mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1, created_by: 1 }] });
            // Mock deletion
            mockPool.query.mockResolvedValueOnce({});

            const res = await request(app)
                .delete('/api/events/1')
                .set('x-auth-token', token);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Event deleted');
        });

        it('should allow admin to delete any event', async () => {
            // Mock finding the event (owned by 1, but request is from admin 2)
            mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1, created_by: 1 }] });
            mockPool.query.mockResolvedValueOnce({});

            const res = await request(app)
                .delete('/api/events/1')
                .set('x-auth-token', adminToken);

            expect(res.statusCode).toBe(200);
        });
    });

    describe('POST /api/events/:id/register', () => {
        it('should register successfully', async () => {
            // Event exists and checking capacity
            mockPool.query.mockResolvedValueOnce({ rows: [{ event_id: 1, capacity: 10, start_time: new Date().toISOString() }] });
            // Check existing registration
            mockPool.query.mockResolvedValueOnce({ rows: [] });
            // Count current regs
            mockPool.query.mockResolvedValueOnce({ rows: [{ current_registrations: 0 }] });
            // Event approval required
            mockPool.query.mockResolvedValueOnce({ rows: [{ requires_approval: false }] });
            // Insert
            mockPool.query.mockResolvedValueOnce({ rows: [{ id: 5 }] });

            const res = await request(app)
                .post('/api/events/1/register')
                .set('x-auth-token', token)
                .send({ timeSlotId: 10 });

            expect(res.statusCode).toBe(201);
            expect(res.body.message).toBe('Registered successfully');
        });

        it('should fail if event is full', async () => {
            // Event exists
            mockPool.query.mockResolvedValueOnce({ rows: [{ event_id: 1, capacity: 1, start_time: new Date().toISOString() }] });
            // Check existing
            mockPool.query.mockResolvedValueOnce({ rows: [] });
            // Current regs = 1 (full)
            mockPool.query.mockResolvedValueOnce({ rows: [{ current_registrations: 1 }] });

            const res = await request(app)
                .post('/api/events/1/register')
                .set('x-auth-token', token)
                .send({ timeSlotId: 10 });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Time slot is full');
        });
    });
});
