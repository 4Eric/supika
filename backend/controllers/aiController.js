const { discoverEvents, insertDiscoveredEvent, recommendEvents } = require('../utils/aiDiscovery');
const { poolPromise } = require('../config/db');
const { mapToCamelCase } = require('../utils/mapper');

// POST /api/ai/discover — Admin-only: Trigger AI event discovery
const discover = async (req, res) => {
    try {
        const { query, lat, lng } = req.body;

        if (!query || query.trim().length === 0) {
            return res.status(400).json({ message: 'Search query is required' });
        }

        // Discover event from the internet
        const eventData = await discoverEvents(query, { lat, lng });

        // Return the discovered event for admin review (NOT inserted yet)
        res.json({
            status: 'preview',
            event: eventData
        });
    } catch (error) {
        console.error('AI Discovery error:', error);
        res.status(500).json({ message: error.message || 'Discovery failed' });
    }
};

// POST /api/ai/approve — Admin-only: Approve and insert a discovered event
const approve = async (req, res) => {
    try {
        const { event } = req.body;

        if (!event || !event.title || !event.date || !event.locationName) {
            return res.status(400).json({ message: 'Incomplete event data' });
        }

        const result = await insertDiscoveredEvent(event);

        if (!result.success) {
            return res.status(409).json({ message: result.reason });
        }

        res.json({
            status: 'approved',
            eventId: result.eventId,
            event: result.event
        });
    } catch (error) {
        console.error('AI Approve error:', error);
        res.status(500).json({ message: error.message || 'Failed to approve event' });
    }
};

// GET /api/ai/discoveries — Admin-only: List all AI-discovered events
const listDiscoveries = async (req, res) => {
    try {
        const pool = await poolPromise;
        const efinderId = parseInt(process.env.EFINDER_USER_ID);

        const result = await pool.query(`
            SELECT e.*, 
            (SELECT MIN(start_time) FROM "EventTimeSlots" ts WHERE ts.event_id = e.id) AS date,
            (SELECT COUNT(*) FROM "Registrations" r JOIN "EventTimeSlots" ts ON r.time_slot_id = ts.id WHERE ts.event_id = e.id) AS attendee_count
            FROM "Events" e
            WHERE e.created_by = $1
            ORDER BY e.created_at DESC
            LIMIT 50
        `, [efinderId]);

        res.json(mapToCamelCase(result.rows));
    } catch (error) {
        console.error('List discoveries error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/ai/recommendations — Personalize event feed based on user history
const getRecommendations = async (req, res) => {
    try {
        const pool = await poolPromise;
        const userId = req.user.id;

        // 1. Get user's history (last 5 registrations)
        const historyRes = await pool.query(`
            SELECT e.title, e.description FROM "Registrations" r
            JOIN "EventTimeSlots" ts ON r.time_slot_id = ts.id
            JOIN "Events" e ON ts.event_id = e.id
            WHERE r.user_id = $1
            ORDER BY r.created_at DESC
            LIMIT 5
        `, [userId]);

        // 2. Get top 20 upcoming events in the next month
        const upcomingRes = await pool.query(`
            SELECT e.id, e.title, e.description, e.image_url, e.latitude, e.longitude, e.location_name,
            (SELECT MIN(start_time) FROM "EventTimeSlots" ts WHERE ts.event_id = e.id) AS date
            FROM "Events" e
            WHERE (SELECT MIN(start_time) FROM "EventTimeSlots" ts WHERE ts.event_id = e.id) >= NOW()
            ORDER BY (SELECT MIN(start_time) FROM "EventTimeSlots" ts WHERE ts.event_id = e.id) ASC
            LIMIT 20
        `);

        if (historyRes.rows.length === 0) {
            // Default: Most recent 5
            return res.json(mapToCamelCase(upcomingRes.rows.slice(0, 5)));
        }

        // 3. Match via AI
        const recommendations = await recommendEvents(historyRes.rows, upcomingRes.rows);

        res.json(mapToCamelCase(recommendations));
    } catch (error) {
        console.error('Recommendations error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { discover, approve, listDiscoveries, getRecommendations };
