const express = require('express');
const router = express.Router();
const { poolPromise } = require('../config/db');

const auth = require('../utils/auth');

// Get global unread messages count
router.get('/unread/count', auth, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.query(`
            SELECT COUNT(*) as unread_count
            FROM "Messages"
            WHERE receiver_id = $1 AND is_read = FALSE
        `, [req.user.id]);
        res.json({ count: parseInt(result.rows[0].unread_count) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all recent conversations for the current user
router.get('/conversations/me', auth, async (req, res) => {
    try {
        const pool = await poolPromise;
        const currentUserId = req.user.id;

        // Query finds the latest message for every distinct (event_id, other_user) pair
        const result = await pool.query(`
            WITH RankedMessages AS (
                SELECT 
                    m.id,
                    m.content,
                    m.created_at,
                    m.event_id,
                    e.title as event_title,
                    CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END as other_user_id,
                    u.username as other_user_name,
                    ROW_NUMBER() OVER(
                        PARTITION BY 
                            CASE WHEN m.sender_id < m.receiver_id THEN m.sender_id ELSE m.receiver_id END,
                            CASE WHEN m.sender_id > m.receiver_id THEN m.sender_id ELSE m.receiver_id END
                        ORDER BY m.created_at DESC
                    ) as rn
                FROM "Messages" m
                JOIN "Events" e ON m.event_id = e.id
                JOIN "Users" u ON (CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END) = u.id
                WHERE m.sender_id = $1 OR m.receiver_id = $1
            )
            SELECT rm.*, 
                (SELECT COUNT(*) FROM "Messages" m2 
                 WHERE m2.sender_id = rm.other_user_id 
                 AND m2.receiver_id = $1 
                 AND m2.is_read = FALSE) as unread_count
            FROM RankedMessages rm 
            WHERE rm.rn = 1
            ORDER BY created_at DESC;
        `, [currentUserId]);

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching conversations' });
    }
});

// Get chat history between current user and another user
router.get('/:otherUserId', auth, async (req, res) => {
    try {
        const pool = await poolPromise;
        const currentUserId = req.user.id;
        const { otherUserId } = req.params;

        // Mark unread messages from this user as read
        await pool.query(`
            UPDATE "Messages" 
            SET is_read = TRUE 
            WHERE receiver_id = $1 
              AND sender_id = $2  
              AND is_read = FALSE
        `, [currentUserId, otherUserId]);

        const result = await pool.query(`
            SELECT m.*, u.username as sender_name 
            FROM "Messages" m
            JOIN "Users" u ON m.sender_id = u.id
            WHERE 
                (m.sender_id = $1 AND m.receiver_id = $2) OR
                (m.sender_id = $2 AND m.receiver_id = $1)
            ORDER BY m.created_at ASC
        `, [currentUserId, otherUserId]);

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Send a new message
router.post('/', auth, async (req, res) => {
    try {
        const { receiver_id, event_id, content } = req.body;
        const sender_id = req.user.id;

        if (!content || !content.trim()) {
            return res.status(400).json({ message: 'Message content cannot be empty' });
        }

        const pool = await poolPromise;
        const result = await pool.query(`
            INSERT INTO "Messages" (sender_id, receiver_id, event_id, content)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [sender_id, receiver_id, event_id, content]);

        const newMessage = result.rows[0];

        // Fetch sender name to return complete message object
        const senderResult = await pool.query('SELECT username FROM "Users" WHERE id = $1', [sender_id]);

        newMessage.sender_name = senderResult.rows[0].username;

        res.status(201).json(newMessage);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// --- Group Messaging Endpoints ---

// Check if user is an approved attendee or the event creator
const isAttendeeOrCreator = async (req, res, next) => {
    try {
        const { eventId, timeSlotId } = req.params;
        const userId = req.user.id;
        const pool = await poolPromise;

        // Admin users can access any group chat
        if (req.user.role === 'admin') {
            return next();
        }

        // Check if user is the creator
        const eventResult = await pool.query('SELECT created_by FROM "Events" WHERE id = $1', [eventId]);
        if (eventResult.rows.length === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }

        if (eventResult.rows[0].created_by === userId) {
            return next();
        }

        // Check if user is a registered attendee (approved or pending) for the specific time slot
        const regResult = await pool.query(`
            SELECT user_id FROM "Registrations" 
            WHERE event_id = $1 AND user_id = $2 AND time_slot_id = $3 AND status != 'rejected'
        `, [eventId, userId, timeSlotId]);

        if (regResult.rows.length > 0) {
            return next();
        }

        return res.status(403).json({ message: 'Access denied. Only registered attendees for this time slot can access this chat.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error verifying access' });
    }
};

// Get group chat history
router.get('/group/:eventId/:timeSlotId', [auth, isAttendeeOrCreator], async (req, res) => {
    try {
        const { eventId, timeSlotId } = req.params;
        const pool = await poolPromise;

        const result = await pool.query(`
            SELECT gm.*, u.username as sender_name 
            FROM "GroupMessages" gm
            JOIN "Users" u ON gm.sender_id = u.id
            WHERE gm.event_id = $1 AND gm.time_slot_id = $2
            ORDER BY gm.created_at ASC
        `, [eventId, timeSlotId]);

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching group history' });
    }
});

// Send a group message
router.post('/group/:eventId/:timeSlotId', [auth, isAttendeeOrCreator], async (req, res) => {
    try {
        const { eventId, timeSlotId } = req.params;
        const { content } = req.body;
        const sender_id = req.user.id;

        if (!content || !content.trim()) {
            return res.status(400).json({ message: 'Message content cannot be empty' });
        }

        const pool = await poolPromise;
        const result = await pool.query(`
            INSERT INTO "GroupMessages" (event_id, time_slot_id, sender_id, content)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [eventId, timeSlotId, sender_id, content]);

        const newMessage = result.rows[0];
        const senderResult = await pool.query('SELECT username FROM "Users" WHERE id = $1', [sender_id]);
        newMessage.sender_name = senderResult.rows[0].username;

        res.status(201).json(newMessage);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error sending group message' });
    }
});

// Get group members
router.get('/group/:eventId/:timeSlotId/members', [auth, isAttendeeOrCreator], async (req, res) => {
    try {
        const { eventId, timeSlotId } = req.params;
        const pool = await poolPromise;

        // Get creator + approved attendees for this specific time slot
        const result = await pool.query(`
            SELECT DISTINCT u.id, u.username, 
                CASE WHEN u.id = e.created_by THEN 'Organizer' ELSE 'Attendee' END as group_role
            FROM "Users" u
            JOIN "Events" e ON e.id = $1
            LEFT JOIN "Registrations" r ON r.event_id = $1 AND r.user_id = u.id AND r.time_slot_id = $2
            WHERE u.id = e.created_by OR (r.status IS NOT NULL AND r.status != 'rejected')
        `, [eventId, timeSlotId]);

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching group members' });
    }
});

module.exports = router;
