const { poolPromise } = require('../config/db');
const { mapToCamelCase } = require('../utils/mapper');

/**
 * Check in an attendee using their ticket token
 */
const checkInByToken = async (req, res) => {
    try {
        const eventId = req.params.id;
        const { ticket_token } = req.body;

        if (!ticket_token) {
            return res.status(400).json({ 
                error: { code: 'validation_error', message: 'Ticket token is required' } 
            });
        }

        const pool = await poolPromise;

        // 2. Find the registration
        const regCheck = await pool.query(
            'SELECT * FROM "Registrations" WHERE event_id = $1 AND ticket_token = $2',
            [eventId, ticket_token]
        );

        if (regCheck.rows.length === 0) {
            return res.status(404).json({ 
                error: { code: 'not_found', message: 'Invalid ticket token for this event' } 
            });
        }

        const registration = regCheck.rows[0];

        // 3. Check if already checked in
        if (registration.check_in_time) {
            return res.status(409).json({ 
                error: { code: 'conflict', message: 'Attendee already checked in' },
                data: { check_in_time: registration.check_in_time }
            });
        }

        // 4. Update check-in time
        const result = await pool.query(
            'UPDATE "Registrations" SET check_in_time = NOW() WHERE id = $1 RETURNING *',
            [registration.id]
        );

        // Fetch user info to return friendly response
        const userResult = await pool.query('SELECT username, email FROM "Users" WHERE id = $1', [registration.user_id]);
        const user = userResult.rows[0];

        res.json({
            message: 'Check-in successful',
            data: {
                username: user.username,
                email: user.email,
                check_in_time: result.rows[0].check_in_time
            }
        });

    } catch (error) {
        console.error('Check-in error:', error);
        res.status(500).json({ 
            error: { code: 'internal_error', message: 'Server error during check-in' } 
        });
    }
};

/**
 * Manual check in by user ID (host clicking a button)
 */
const manualCheckIn = async (req, res) => {
    try {
        const eventId = req.params.id;
        const userId = req.params.userId;
        const pool = await poolPromise;

        // 2. Update check-in time
        const result = await pool.query(
            'UPDATE "Registrations" SET check_in_time = NOW() WHERE event_id = $1 AND user_id = $2 RETURNING *',
            [eventId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Registration not found' });
        }

        res.json({
            message: 'Manual check-in successful',
            data: mapToCamelCase(result.rows[0])
        });

    } catch (error) {
        console.error('Manual check-in error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    checkInByToken,
    manualCheckIn
};
