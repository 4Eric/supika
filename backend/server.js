const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const app = express();
const logger = require('./utils/logger');
const requestLogger = require('./middlewares/requestLogger');
const errorHandler = require('./middlewares/errorHandler');
const { globalLimiter } = require('./middlewares/rateLimiter');

// Process level exception handlers
process.on('uncaughtException', (err) => {
    logger.fatal(err, 'Uncaught Exception!');
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    logger.fatal(err, 'Unhandled Rejection!');
    process.exit(1);
});

// Trust the proxy (Render load balancer) first
app.set('trust proxy', true);

// Security Headers
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Global Rate Limiter
app.use(globalLimiter);

// Request Logger
app.use(requestLogger);

// CORS - restrict to frontend origin(s)
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(o => o.trim()).filter(o => o);
const defaultWhitelist = [
    'http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174', 'https://supika.onrender.com', 'https://supika-vibe.onrender.com', 'https://supika.vercel.app'
];
const fullWhitelist = [...allowedOrigins, ...defaultWhitelist];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        if (fullWhitelist.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use((req, res, next) => {
    if (req.originalUrl === '/api/payments/webhook') {
        next();
    } else {
        express.json()(req, res, next);
    }
});

// Health Check (for heartbeats)
app.get('/health', (req, res) => res.status(200).send('OK'));

// Serve static uploaded files (fallback for legacy local uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/users', require('./routes/users'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/v1/events', require('./routes/checkin'));

// Global Error Handler (must be after all routes)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, '0.0.0.0', () => logger.info(`Server started on port ${PORT}`));
}

module.exports = app;
