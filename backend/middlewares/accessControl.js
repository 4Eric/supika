const { poolPromise } = require('../config/db');

/**
 * Middleware to verify that the current user is the host (creator) of the specified event.
 * Expects eventId in req.params.
 */
const isEventHost = async (req, res, next) => {
    try {
        const eventId = req.params.id || req.params.eventId;
        if (!eventId) {
            return res.status(400).json({ message: 'Event ID is required' });
        }

        const pool = await poolPromise;
        const result = await pool.query('SELECT created_by FROM "Events" WHERE id = $1', [eventId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }

        if (result.rows[0].created_by != req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        next();
    } catch (error) {
        console.error('Access control error:', error);
        res.status(500).json({ message: 'Internal server error during authorization' });
    }
};

module.exports = {
    isEventHost
};
