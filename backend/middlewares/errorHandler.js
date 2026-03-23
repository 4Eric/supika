const logger = require('../utils/logger');
const { error } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
    logger.error({
        reqId: req.id,
        method: req.method,
        url: req.originalUrl,
        error: err.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
        userId: req.user?.userId || 'guest'
    }, 'Unhandled error caught by global handler');

    // Handle specific documented errors
    if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) { // JSON parse error from express.json()
        return error(res, 'Invalid JSON payload', 400, 'BAD_JSON');
    }

    if (err.message && err.message.includes('Not allowed by CORS')) {
        return error(res, 'CORS policy violation', 403, 'CORS_ERROR');
    }

    if (err.code === 'LIMIT_FILE_SIZE') { // Multer error
        return error(res, 'File too large', 413, 'FILE_TOO_LARGE');
    }

    // Default 500
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message || 'Internal server error';

    error(res, message, err.statusCode || 500, err.code || 'INTERNAL_ERROR');
};

module.exports = errorHandler;
