const pino = require('pino');

const isDev = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test';

// In production or test, log json (or disable). In dev, use pino-pretty for readable logs
const transport = isDev
    ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
        }
    }
    : undefined;

const logger = pino({
    level: process.env.NODE_ENV === 'test' ? 'silent' : (process.env.LOG_LEVEL || 'info'),
    timestamp: pino.stdTimeFunctions.isoTime,
    transport
});

module.exports = logger;
