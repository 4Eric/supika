const request = require('supertest');
const express = require('express');
const errorHandler = require('../middlewares/errorHandler');
const { error } = require('../utils/response');

describe('Middleware APIs', () => {

    describe('Global Error Handler', () => {
        let app;

        beforeEach(() => {
            app = express();
            // Dummy route that throws
            app.get('/crash', (req, res, next) => {
                const err = new Error('Database disconnected');
                err.status = 503;
                next(err);
            });
            // Dummy route throwing JSON syntax
            app.post('/json', (req, res, next) => {
                const err = new SyntaxError('Unexpected token');
                err.status = 400;
                err.body = '{ bad json';
                next(err);
            });

            // Mount errorHandler last
            app.use(errorHandler);
        });

        it('should catch unhandled errors and return JSON instead of HTML', async () => {
            const res = await request(app).get('/crash');

            expect(res.statusCode).toBe(503);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe('Database disconnected');
        });

        it('should handle malformed JSON syntax gracefully', async () => {
            const res = await request(app).post('/json');

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Invalid JSON payload');
            expect(res.body.code).toBe('BAD_JSON');
        });
    });

    describe('Response Utility', () => {
        it('should format error responses correctly', () => {
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            error(mockRes, 'Not found', 404, 'NOT_FOUND');

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                message: 'Not found',
                code: 'NOT_FOUND'
            });
        });
    });
});
