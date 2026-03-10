const rateLimit = require('express-rate-limit');
const { error } = require('../utils/response');

const createLimiter = (options) => {
    return rateLimit({
        windowMs: options.windowMs || 15 * 60 * 1000,
        max: options.max,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            error(res, options.message || 'Too many requests, please try again later', 429, 'RATE_LIMIT_EXCEEDED');
        }
    });
};

const globalLimiter = createLimiter({
    windowMs: 15 * 60 * 1000, // 15 mins
    max: 100, // 100 req per IP
});

const loginLimiter = createLimiter({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 5, // 5 failed login attempts
    message: 'Too many login attempts, please try again after 15 minutes'
});

const registerLimiter = createLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: 'Too many accounts created from this IP, please try again later'
});

const aiDiscoverLimiter = createLimiter({
    windowMs: 60 * 60 * 1000, // 1 hr
    max: 5,
    message: 'AI discovery limit reached, please try again later'
});

const eventsWriteLimiter = createLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: 'You have published too many events recently, wait before publishing another'
});

module.exports = {
    globalLimiter,
    loginLimiter,
    registerLimiter,
    aiDiscoverLimiter,
    eventsWriteLimiter
};
