const crypto = require('crypto');
const logger = require('../utils/logger');

const requestLogger = (req, res, next) => {
    req.id = crypto.randomUUID();
    const startTime = Date.now();

    // Log when request completes
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.info({
            reqId: req.id,
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            userId: req.user?.userId || 'guest',
            ip: req.ip
        }, `${req.method} ${req.originalUrl} [${res.statusCode}] - ${duration}ms`);
    });

    next();
};

module.exports = requestLogger;
