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
        
        // Multi-host support: check if user is in EventHosts or is the original created_by or is admin
        const result = await pool.query(`
            SELECT e.created_by, EXISTS(SELECT 1 FROM "EventHosts" eh WHERE eh.event_id = e.id AND eh.user_id = $1) as is_cohost
            FROM "Events" e 
            WHERE e.id = $2
        `, [req.user.id, eventId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }

        const isOwner = result.rows[0].created_by == req.user.id;
        const isCohost = result.rows[0].is_cohost;
        const isAdmin = req.user.role === 'admin';

        if (!isOwner && !isCohost && !isAdmin) {
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
