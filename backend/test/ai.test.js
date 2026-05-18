const request = require('supertest');
const app = require('../server');
const { pgPool, poolPromise } = require('../config/db');
const jwt = require('jsonwebtoken');

// Mock external dependencies
jest.mock('../config/db', () => {
    const mockPoolObj = {
        query: jest.fn(),
        connect: jest.fn().mockImplementation(function() {
            return Promise.resolve({
                query: (sql, params) => {
                    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return Promise.resolve({});
                    return mockPoolObj.query(sql, params);
                },
                release: jest.fn()
            });
        }),
        release: jest.fn()
    };
    return {
        pgPool: { query: jest.fn(), on: jest.fn(), end: jest.fn() },
        poolPromise: Promise.resolve(mockPoolObj)
    };
});

jest.mock('@google/generative-ai', () => {
    return {
        GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
            getGenerativeModel: jest.fn().mockReturnValue({
                generateContent: jest.fn().mockResolvedValue({
                    response: {
                        text: () => JSON.stringify({
                            title: 'AI Discovered Concert',
                            description: 'Sample description',
                            date: new Date().toISOString(),
                            locationName: 'London',
                            imageUrl: 'http://example.com/image.jpg',
                            sourceUrl: 'http://example.com',
                            category: 'music'
                        })
                    }
                })
            })
        }))
    };
});

jest.mock('axios', () => ({
    get: jest.fn().mockResolvedValue({
        data: [{ lat: '51.5074', lon: '-0.1278' }] // Mock Nominatim Geocoding
    }),
    head: jest.fn().mockResolvedValue({ status: 200 }) // Mock URL check
}));

describe('AI Discovery API Endpoints', () => {
    let mockPool;
    const adminToken = jwt.sign({ user: { id: 1, role: 'admin' } }, 'test_secret', { expiresIn: '1h' });
    const userToken = jwt.sign({ user: { id: 2, role: 'user' } }, 'test_secret', { expiresIn: '1h' });

    beforeAll(async () => {
        mockPool = await poolPromise;
        process.env.JWT_SECRET = 'test_secret';
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/ai/discover', () => {
        it('should deny non-admin users', async () => {
            const res = await request(app)
                .post('/api/ai/discover')
                .set('x-auth-token', userToken)
                .send({ query: 'Events in London', numResults: 1 });

            expect(res.statusCode).toBe(403);
            expect(res.body.message).toBe('Admin access required');
        });

        it('should run discovery and insert unapproved events as admin', async () => {
            // Mock deduplication check (no existing events)
            mockPool.query.mockResolvedValueOnce({ rows: [] });
            // Mock inserting the event
            mockPool.query.mockResolvedValueOnce({ rows: [{ id: 100 }] });
            // Mock inserting time slot
            mockPool.query.mockResolvedValueOnce({});

            const res = await request(app)
                .post('/api/ai/discover')
                .set('x-auth-token', adminToken)
                .send({ query: 'Events in London' });

            expect(res.statusCode).toBe(200);
            expect(res.body.status).toBe('preview');
            expect(res.body.event.title).toBe('AI Discovered Concert');
            expect(res.body.event.latitude).toBe(51.5074);
        });
    });
});
