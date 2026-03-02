const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const app = express();

// Trust the proxy (Render load balancer) first
app.set('trust proxy', true);

// Security Headers
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS - restrict to frontend origin(s)
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(o => o.trim()).filter(o => o);
const defaultWhitelist = [
    'http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174', 'https://supika.onrender.com', 'https://supika-vibe.onrender.com', 'https://supika.vercel.app'
];
const fullWhitelist = [...allowedOrigins, ...defaultWhitelist];

app.use(cors({
    origin: function (origin, callback) {
        // Skip check for tools or same-origin
        if (!origin) return callback(null, true);

        const isAllowed = fullWhitelist.includes(origin) ||
            fullWhitelist.includes(origin + '/') || // match trailing slash
            origin.endsWith('.onrender.com') ||
            origin.endsWith('.vercel.app');

        if (isAllowed) {
            callback(null, true);
        } else {
            console.warn(`🚨 CORS BLOCKED: [${origin}] is not in whitelist.`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());

// Health Check (for heartbeats)
app.get('/health', (req, res) => res.status(200).send('OK'));

// Serve static uploaded files (fallback for legacy local uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
app.use('/api/messages', require('./routes/messages'));

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => console.log(`Server started on port ${PORT}`));
