const pino = require('pino');

const isDev = process.env.NODE_ENV !== 'production';

// In production, log json. In dev, use pino-pretty for readable logs
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
    level: process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    transport
});

module.exports = logger;
