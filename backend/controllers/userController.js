const { poolPromise } = require('../config/db');
const { mapToCamelCase } = require('../utils/mapper');
const cacheService = require('../utils/cacheService');

const getPublicProfile = async (req, res) => {
    try {
        const pool = await poolPromise;
        const userId = req.params.id;

        // Fetch user basic info
        const userResult = await pool.query(`
            SELECT id, username, created_at,
            (SELECT COUNT(*) FROM "Events" WHERE created_by = $1) as events_hosted_count,
            (SELECT COUNT(*) FROM "Registrations" r JOIN "Events" e ON r.event_id = e.id WHERE e.created_by = $1 AND (r.status = 'approved' OR r.status IS NULL)) as total_attendees_count
            FROM "Users"
            WHERE id = $1
        `, [userId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(mapToCamelCase(userResult.rows[0]));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getUserEvents = async (req, res) => {
    try {
        const userId = req.params.id;
        const timeFilter = req.query.time_filter === 'past' ? 'past' : 'upcoming';

        const pool = await poolPromise;
        const timeComparison = timeFilter === 'past' ? '<' : '>=';
        const sortOrder = timeFilter === 'past' ? 'DESC' : 'ASC';

        const result = await pool.query(`
            SELECT e.*, u.username as creator_name,
            (SELECT MIN(start_time) FROM "EventTimeSlots" ts WHERE ts.event_id = e.id) AS date,
            (SELECT COUNT(*) FROM "Registrations" r JOIN "EventTimeSlots" ts ON r.time_slot_id = ts.id WHERE ts.event_id = e.id AND (r.status = 'approved' OR r.status IS NULL)) AS attendee_count
            FROM "Events" e 
            LEFT JOIN "Users" u ON e.created_by = u.id 
            WHERE e.created_by = $1
            AND (SELECT MIN(start_time) FROM "EventTimeSlots" ts WHERE ts.event_id = e.id) ${timeComparison} NOW()
            ORDER BY (SELECT MIN(start_time) FROM "EventTimeSlots" ts WHERE ts.event_id = e.id) ${sortOrder}
        `, [userId]);

        res.json(mapToCamelCase(result.rows));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getPublicProfile,
    getUserEvents
};
