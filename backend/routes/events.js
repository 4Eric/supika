const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { poolPromise } = require('../config/db');
const { sendConfirmationEmail } = require('../utils/mailer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary (auto-reads CLOUDINARY_URL env var)
cloudinary.config();

// Cloudinary storage for multer
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'supika-events',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov'],
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
    },
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// Middleware to protect routes (basic implementation)
const auth = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });
    try {
        const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'secret');
        req.user = decoded.user;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

// Get all events
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.query(`
            SELECT e.*, u.username as creator_name,
            (SELECT MIN(start_time) FROM "EventTimeSlots" ts WHERE ts.event_id = e.id) AS date,
            (SELECT COUNT(*) FROM "Registrations" r JOIN "EventTimeSlots" ts ON r.time_slot_id = ts.id WHERE ts.event_id = e.id AND (r.status = 'approved' OR r.status IS NULL)) AS attendee_count
            FROM "Events" e 
            LEFT JOIN "Users" u ON e.created_by = u.id 
            ORDER BY (SELECT MIN(start_time) FROM "EventTimeSlots" ts WHERE ts.event_id = e.id) ASC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get registered events for current user
router.get('/registered/me', auth, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.query(`
            SELECT e.*, r.status, ts.start_time AS date, ts.id AS time_slot_id
            FROM "Events" e
            JOIN "EventTimeSlots" ts ON e.id = ts.event_id
            JOIN "Registrations" r ON ts.id = r.time_slot_id
            WHERE r.user_id = $1
            ORDER BY ts.start_time ASC
        `, [req.user.id]);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get hosted events for current user
router.get('/hosted/me', auth, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.query(`
            SELECT e.*,
            (SELECT MIN(start_time) FROM "EventTimeSlots" ts WHERE ts.event_id = e.id) AS date,
            (SELECT COUNT(*) FROM "Registrations" r JOIN "EventTimeSlots" ts ON r.time_slot_id = ts.id WHERE ts.event_id = e.id AND (r.status = 'approved' OR r.status IS NULL)) AS attendee_count
            FROM "Events" e
            WHERE e.created_by = $1
            ORDER BY (SELECT MIN(start_time) FROM "EventTimeSlots" ts WHERE ts.event_id = e.id) ASC
        `, [req.user.id]);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get single event
router.get('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.query(`
            SELECT e.*, u.username as creator_name 
            FROM "Events" e 
            LEFT JOIN "Users" u ON e.created_by = u.id 
            WHERE e.id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }

        const event = result.rows[0];

        // Fetch time slots
        const timeSlotsResult = await pool.query(`
            SELECT id, start_time, duration_minutes, max_attendees,
            (SELECT COUNT(*) FROM "Registrations" r WHERE r.time_slot_id = "EventTimeSlots".id AND (r.status = 'approved' OR r.status IS NULL)) AS attendee_count
            FROM "EventTimeSlots"
            WHERE event_id = $1
            ORDER BY start_time ASC
        `, [event.id]);

        event.time_slots = timeSlotsResult.rows;

        // Fetch requested media files matching this event
        const mediaResult = await pool.query(`
            SELECT id, media_url, media_type 
            FROM "EventMedia" 
            WHERE event_id = $1 
            ORDER BY created_at ASC
        `, [event.id]);

        event.media = mediaResult.rows;
        res.json(event);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create event
router.post('/', [auth, upload.array('media', 10)], async (req, res) => {
    let client;
    try {
        const { title, description, location_name, latitude, longitude, requires_approval, time_slots, date } = req.body;
        const pool = await poolPromise;
        client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Set the primary image_url from the first provided image file if any, else default
            let primaryImage = 'default_event.png';
            if (req.files && req.files.length > 0) {
                const firstImage = req.files.find(f => f.mimetype.startsWith('image/'));
                if (firstImage) {
                    primaryImage = firstImage.path;
                }
            }

            const isApprovalRequired = requires_approval === 'true' || requires_approval === true;

            const result = await client.query(`
                INSERT INTO "Events" (title, description, location_name, latitude, longitude, created_by, image_url, requires_approval)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `, [
                title,
                description,
                location_name,
                parseFloat(latitude) || null,
                parseFloat(longitude) || null,
                req.user.id,
                primaryImage,
                isApprovalRequired
            ]);

            const eventId = result.rows[0].id;

            // Insert Time Slots
            let parsedTimeSlots = [];
            try {
                parsedTimeSlots = typeof time_slots === 'string' ? JSON.parse(time_slots) : time_slots;
            } catch (e) {
                console.error("Failed to parse time slots", e);
            }
            if (!parsedTimeSlots || parsedTimeSlots.length === 0) {
                // Defensive fallback: if none provided, use date if available, else current time
                const startTime = date ? new Date(date) : new Date();
                parsedTimeSlots = [{ start_time: startTime.toISOString(), duration_minutes: 60, max_attendees: 5 }];
            }

            for (let slot of parsedTimeSlots) {
                await client.query(`
                    INSERT INTO "EventTimeSlots" (event_id, start_time, duration_minutes, max_attendees)
                    VALUES ($1, $2, $3, $4)
                `, [
                    eventId,
                    new Date(slot.start_time).toISOString(),
                    parseInt(slot.duration_minutes) || 60,
                    parseInt(slot.max_attendees) || 5
                ]);
            }

            // Insert multiple media records
            if (req.files && req.files.length > 0) {
                for (let file of req.files) {
                    const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
                    await client.query(`
                        INSERT INTO "EventMedia" (event_id, media_url, media_type)
                        VALUES ($1, $2, $3)
                    `, [eventId, file.path, mediaType]);
                }
            }

            await client.query('COMMIT');
            res.status(201).json(result.rows[0]);
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(error);
            res.status(500).json({ message: 'Server error during transaction' });
        } finally {
            if (client) client.release();
        }
    } catch (error) {
        console.error(error);
        if (client) client.release();
        res.status(500).json({ message: 'Server error parsing request' });
    }
});

// Update an existing event (Creator Only)
router.put('/:id', [auth, upload.array('media', 10)], async (req, res) => {
    let client;
    try {
        const eventId = req.params.id;
        const { title, description, location_name, latitude, longitude, requires_approval, time_slots } = req.body;
        const pool = await poolPromise;

        // Verify creator
        const eventCheck = await pool.query('SELECT created_by FROM "Events" WHERE id = $1', [eventId]);

        if (eventCheck.rows.length === 0) return res.status(404).json({ message: 'Event not found' });
        if (eventCheck.rows[0].created_by != req.user.id) return res.status(403).json({ message: 'Not authorized to edit this event' });

        client = await pool.connect();
        await client.query('BEGIN');

        try {
            const isApprovalRequired = requires_approval === 'true' || requires_approval === true;

            // Set primary image if new files uploaded
            let imageUpdateSql = "";
            let queryParams = [title, description, location_name, parseFloat(latitude) || null, parseFloat(longitude) || null, isApprovalRequired, eventId];
            let paramIndex = 8;

            if (req.files && req.files.length > 0) {
                const firstImage = req.files.find(f => f.mimetype.startsWith('image/'));
                if (firstImage) {
                    imageUpdateSql = `, image_url = $${paramIndex}`;
                    queryParams.push(firstImage.filename);
                    paramIndex++;
                }
            }

            await client.query(`
                UPDATE "Events" 
                SET title = $1, description = $2, location_name = $3, 
                    latitude = $4, longitude = $5, requires_approval = $6
                    ${imageUpdateSql}
                WHERE id = $7
            `, queryParams);

            // Apply Time Slots Sync
            let parsedTimeSlots = [];
            try {
                parsedTimeSlots = typeof time_slots === 'string' ? JSON.parse(time_slots) : time_slots;
            } catch (e) {
                console.error("Failed to parse time slots", e);
            }

            if (parsedTimeSlots && parsedTimeSlots.length > 0) {
                const incomingIds = parsedTimeSlots.filter(s => s.id != null).map(s => parseInt(s.id));

                if (incomingIds.length > 0) {
                    await client.query(`DELETE FROM "EventTimeSlots" WHERE event_id = $1 AND id NOT IN (${incomingIds.join(',')})`, [eventId]);
                } else {
                    await client.query(`DELETE FROM "EventTimeSlots" WHERE event_id = $1`, [eventId]);
                }

                for (let slot of parsedTimeSlots) {
                    if (slot.id != null) {
                        await client.query(`
                            UPDATE "EventTimeSlots" 
                            SET start_time = $1, duration_minutes = $2, max_attendees = $3
                            WHERE id = $4
                        `, [new Date(slot.start_time).toISOString(), parseInt(slot.duration_minutes) || 60, parseInt(slot.max_attendees) || 5, parseInt(slot.id)]);
                    } else {
                        await client.query(`
                            INSERT INTO "EventTimeSlots" (event_id, start_time, duration_minutes, max_attendees)
                            VALUES ($1, $2, $3, $4)
                        `, [eventId, new Date(slot.start_time).toISOString(), parseInt(slot.duration_minutes) || 60, parseInt(slot.max_attendees) || 5]);
                    }
                }
            }

            // If new media uploaded, delete old media and insert new records
            if (req.files && req.files.length > 0) {
                await client.query('DELETE FROM "EventMedia" WHERE event_id = $1', [eventId]);

                for (let file of req.files) {
                    const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
                    await client.query(`
                        INSERT INTO "EventMedia" (event_id, media_url, media_type)
                        VALUES ($1, $2, $3)
                    `, [eventId, file.filename, mediaType]);
                }
            }

            await client.query('COMMIT');
            res.json({ message: 'Event updated successfully' });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(error);
            res.status(500).json({ message: 'Server error during update transaction' });
        } finally {
            if (client) client.release();
        }
    } catch (error) {
        console.error(error);
        if (client) client.release();
        res.status(500).json({ message: 'Server error parsing request' });
    }
});

// Register for event
router.post('/:id/register', auth, async (req, res) => {
    try {
        const eventId = req.params.id;
        const userId = req.user.id;
        const { time_slot_id } = req.body;

        const pool = await poolPromise;

        // Check if event exists
        const eventResult = await pool.query('SELECT * FROM "Events" WHERE id = $1', [eventId]);

        if (eventResult.rows.length === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }

        const event = eventResult.rows[0];
        const status = event.requires_approval ? 'pending' : 'approved';

        // Get target time slot
        let targetSlotId = time_slot_id;
        if (!targetSlotId) {
            const slotRes = await pool.query('SELECT id FROM "EventTimeSlots" WHERE event_id = $1 ORDER BY start_time ASC LIMIT 1', [eventId]);
            if (slotRes.rows.length > 0) targetSlotId = slotRes.rows[0].id;
        }

        // Register user
        try {
            await pool.query(`
                INSERT INTO "Registrations" (user_id, event_id, time_slot_id, status)
                VALUES ($1, $2, $3, $4)
            `, [userId, eventId, targetSlotId, status]);
        } catch (regError) {
            if (regError.code === '23505') {
                return res.status(400).json({ message: 'Already registered for this event' });
            }
            throw regError;
        }

        // Get user email
        const userResult = await pool.query('SELECT email FROM "Users" WHERE id = $1', [userId]);

        if (userResult.rows.length > 0) {
            const userEmail = userResult.rows[0].email;
            // Send email confirmation
            sendConfirmationEmail(userEmail, event);
        }

        res.json({ message: 'Successfully registered for event' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Deregister from an event
router.delete('/:id/register', auth, async (req, res) => {
    try {
        const eventId = req.params.id;
        const userId = req.user.id;
        const timeSlotId = req.body.time_slot_id || req.query.time_slot_id;
        const pool = await poolPromise;

        let query = `DELETE FROM "Registrations" WHERE user_id = $1 AND event_id = $2`;
        const queryParams = [userId, eventId];

        if (timeSlotId) {
            query += ` AND time_slot_id = $3`;
            queryParams.push(timeSlotId);
        }

        const result = await pool.query(query, queryParams);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Registration not found' });
        }

        res.json({ message: 'Successfully deregistered from event' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get attendees for an event (creator only)
router.get('/:id/attendees', auth, async (req, res) => {
    try {
        const eventId = req.params.id;
        const pool = await poolPromise;

        // Verify creator
        const eventCheck = await pool.query('SELECT created_by FROM "Events" WHERE id = $1', [eventId]);

        if (eventCheck.rows.length === 0) return res.status(404).json({ message: 'Event not found' });
        if (eventCheck.rows[0].created_by != req.user.id) return res.status(403).json({ message: 'Not authorized' });

        const result = await pool.query(`
                SELECT u.id, u.username, u.email, r.status, r.registration_date as created_at, ts.start_time as time_slot
                FROM "Registrations" r
                JOIN "Users" u ON r.user_id = u.id
                LEFT JOIN "EventTimeSlots" ts ON r.time_slot_id = ts.id
                WHERE r.event_id = $1
                ORDER BY r.registration_date DESC
            `, [eventId]);

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update attendee status (creator only)
router.put('/:id/attendees/:userId', auth, async (req, res) => {
    try {
        const { id: eventId, userId } = req.params;
        const { status } = req.body;

        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const pool = await poolPromise;

        // Verify creator
        const eventCheck = await pool.query('SELECT created_by FROM "Events" WHERE id = $1', [eventId]);

        if (eventCheck.rows.length === 0) return res.status(404).json({ message: 'Event not found' });
        if (eventCheck.rows[0].created_by != req.user.id) return res.status(403).json({ message: 'Not authorized' });

        const result = await pool.query(`
                UPDATE "Registrations" 
                SET status = $1 
                WHERE user_id = $2 AND event_id = $3
            `, [status, userId, eventId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Registration not found' });
        }

        res.json({ message: 'Attendee status updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete event (creator only)
router.delete('/:id', auth, async (req, res) => {
    try {
        const eventId = req.params.id;
        const pool = await poolPromise;

        // Verify creator
        const eventCheck = await pool.query('SELECT created_by FROM "Events" WHERE id = $1', [eventId]);

        if (eventCheck.rows.length === 0) return res.status(404).json({ message: 'Event not found' });
        if (eventCheck.rows[0].created_by != req.user.id) return res.status(403).json({ message: 'Not authorized to delete this event' });

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Delete associated media
            await client.query('DELETE FROM "EventMedia" WHERE event_id = $1', [eventId]);
            // Delete associated messages
            await client.query('DELETE FROM "Messages" WHERE event_id = $1', [eventId]);
            // Delete associated group messages
            await client.query('DELETE FROM "GroupMessages" WHERE event_id = $1', [eventId]);
            // Delete associated registrations
            await client.query('DELETE FROM "Registrations" WHERE event_id = $1', [eventId]);
            // Delete associated time slots
            await client.query('DELETE FROM "EventTimeSlots" WHERE event_id = $1', [eventId]);
            // Delete the event itself
            await client.query('DELETE FROM "Events" WHERE id = $1', [eventId]);

            await client.query('COMMIT');
            res.json({ message: 'Event deleted successfully' });
        } catch (err) {
            if (client) await client.query('ROLLBACK');
            throw err;
        } finally {
            if (client) client.release();
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error deleting event' });
    }
});

module.exports = router;
