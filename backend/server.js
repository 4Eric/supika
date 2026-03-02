const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const app = express();

// Trust the proxy (Render load balancer) for express-rate-limit
app.set('trust proxy', 1);

// Security Headers
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS - restrict to frontend origin(s)
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174,http://192.168.2.37:5173,http://192.168.2.37:5174,https://supika.onrender.com,https://supika-vibe.onrender.com,https://supika.vercel.app').split(',');

app.use(cors({
    origin: function (origin, callback) {
        // Allow same-origin (null) or whitelisted origins or any .onrender.com for now
        if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.onrender.com')) {
            callback(null, true);
        } else {
            console.warn(`CORS BLOCKED for origin: ${origin}`);
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
