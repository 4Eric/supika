const { poolPromise } = require('../config/db');
const { mapToCamelCase } = require('../utils/mapper');
const { sendConfirmationEmail } = require('../utils/mailer');
const cacheService = require('../utils/cacheService');
const { invalidateEventCaches } = require('../utils/cacheHelper');

const getAllEvents = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const timeFilter = req.query.time_filter === 'past' ? 'past' : 'upcoming';

        // Use a cache key that represents the query but allow for mutation
        const cacheKey = `all_events_${timeFilter}`;
        let cachedEvents = cacheService.get(cacheKey);

        if (cachedEvents) {
            // Return slice from cache
            const slice = cachedEvents.slice(offset, offset + limit);
            return res.json(slice);
        }

        const pool = await poolPromise;
        const timeComparison = timeFilter === 'past' ? '<' : '>=';
        const sortOrder = timeFilter === 'past' ? 'DESC' : 'ASC';

        // Fetch a larger set (e.g. 1000) to keep the cache meaningful for pagination/map
        const result = await pool.query(`
            SELECT e.*, u.username as creator_name,
            (SELECT MIN(start_time) FROM "EventTimeSlots" ts WHERE ts.event_id = e.id) AS date,
            (SELECT COUNT(*) FROM "Registrations" r JOIN "EventTimeSlots" ts ON r.time_slot_id = ts.id WHERE ts.event_id = e.id AND (r.status = 'approved' OR r.status IS NULL)) AS attendee_count
            FROM "Events" e 
            LEFT JOIN "Users" u ON e.created_by = u.id 
            WHERE (SELECT MIN(start_time) FROM "EventTimeSlots" ts WHERE ts.event_id = e.id) ${timeComparison} NOW()
            ORDER BY (SELECT MIN(start_time) FROM "EventTimeSlots" ts WHERE ts.event_id = e.id) ${sortOrder}
            LIMIT 1000
        `);

        const allMapped = mapToCamelCase(result.rows);
        cacheService.set(cacheKey, allMapped);

        res.json(allMapped.slice(offset, offset + limit));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const { syncPendingTransactions } = require('../utils/stripeSync');

const getRegisteredEvents = async (req, res) => {
    try {
        const pool = await poolPromise;

        // Before returning registrations, let's check for any "Pending" payments 
        // to sync them with Stripe (important for local dev without webhooks)
        await syncPendingTransactions(req.user.id);

        const result = await pool.query(`
            SELECT e.*, r.status, r.ticket_token, ts.start_time AS date, ts.id AS time_slot_id
            FROM "Events" e
            JOIN "EventTimeSlots" ts ON e.id = ts.event_id
            JOIN "Registrations" r ON ts.id = r.time_slot_id
            WHERE r.user_id = $1
            ORDER BY ts.start_time ASC
        `, [req.user.id]);
        res.json(mapToCamelCase(result.rows));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getHostedEvents = async (req, res) => {
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
        res.json(mapToCamelCase(result.rows));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getEventById = async (req, res) => {
    try {
        const cacheKey = `event_${req.params.id}`;
        const cachedEvent = cacheService.get(cacheKey);
        if (cachedEvent) return res.json(cachedEvent);

        const pool = await poolPromise;
        const result = await pool.query(`
            SELECT e.*, u.username as creator_name 
            FROM "Events" e 
            LEFT JOIN "Users" u ON e.created_by = u.id 
            WHERE e.id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) return res.status(404).json({ message: 'Event not found' });

        const event = result.rows[0];
        const timeSlotsResult = await pool.query(`
            SELECT id, start_time, duration_minutes, max_attendees,
            (SELECT COUNT(*) FROM "Registrations" r WHERE r.time_slot_id = "EventTimeSlots".id AND (r.status = 'approved' OR r.status IS NULL)) AS attendee_count
            FROM "EventTimeSlots"
            WHERE event_id = $1
            ORDER BY start_time ASC
        `, [event.id]);

        event.time_slots = timeSlotsResult.rows;
        const mediaResult = await pool.query(`
            SELECT id, media_url, media_type 
            FROM "EventMedia" 
            WHERE event_id = $1 
            ORDER BY created_at ASC
        `, [event.id]);

        event.media = mediaResult.rows;
        const mapped = mapToCamelCase(event);

        // Cache for 30 seconds
        cacheService.set(cacheKey, mapped, 30);

        res.json(mapped);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getPrimaryImage = (files) => {
    if (!files || files.length === 0) return 'default_event.png';
    const firstImg = files.find(f => f.mimetype.startsWith('image/'));
    if (!firstImg) return 'default_event.png';
    return process.env.USE_LOCAL_STORAGE === 'true' ? firstImg.filename : firstImg.path;
};

const normalizeEventData = (body) => {
    const {
        title, description, locationName, location_name,
        latitude, longitude, requiresApproval, requires_approval,
        ticketPrice, ticket_price, currency,
        timeSlots, time_slots, date
    } = body;

    return {
        title,
        description,
        locationName: locationName || location_name,
        latitude: (latitude !== undefined && latitude !== null) ? parseFloat(latitude) : null,
        longitude: (longitude !== undefined && longitude !== null) ? parseFloat(longitude) : null,
        requiresApproval: (requiresApproval !== undefined) ? (requiresApproval === 'true' || requiresApproval === true) : (requires_approval === 'true' || requires_approval === true),
        ticketPrice: (ticketPrice !== undefined && ticketPrice !== null) ? parseFloat(ticketPrice) : (ticket_price !== undefined ? parseFloat(ticket_price) : 0),
        currency: currency || 'CAD',
        timeSlots: timeSlots || time_slots,
        date
    };
};

const insertTimeSlots = async (client, eventId, timeSlots, defaultDate) => {
    let parsedSlots = [];
    try {
        parsedSlots = typeof timeSlots === 'string' ? JSON.parse(timeSlots) : timeSlots;
    } catch (e) {
        console.error("Failed to parse time slots", e);
    }
    if (!parsedSlots || parsedSlots.length === 0) {
        const startTime = defaultDate ? new Date(defaultDate) : new Date();
        parsedSlots = [{ start_time: startTime.toISOString(), duration_minutes: 60, max_attendees: 5 }];
    }
    for (let slot of parsedSlots) {
        const startTime = slot.startTime || slot.start_time;
        const durationMinutes = slot.durationMinutes || slot.duration_minutes;
        const maxAttendees = slot.maxAttendees || slot.max_attendees;

        if (!startTime) {
            console.warn("Skipping slot with missing start time");
            continue;
        }

        await client.query(`
            INSERT INTO "EventTimeSlots" (event_id, start_time, duration_minutes, max_attendees)
            VALUES ($1, $2, $3, $4)
        `, [
            eventId,
            new Date(startTime).toISOString(),
            parseInt(durationMinutes) || 60,
            parseInt(maxAttendees) || 5
        ]);
    }
};

const insertEventMedia = async (client, eventId, files) => {
    if (!files || files.length === 0) return;
    for (let file of files) {
        const mediaUrl = process.env.USE_LOCAL_STORAGE === 'true' ? file.filename : file.path;
        const mediaType = file.mimetype.startsWith('image/') ? 'image' : 'video';
        await client.query(`
            INSERT INTO "EventMedia" (event_id, media_url, media_type)
            VALUES ($1, $2, $3)
        `, [eventId, mediaUrl, mediaType]);
    }
};

const createEvent = async (req, res) => {
    const data = normalizeEventData(req.body);
    const pool = await poolPromise;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const primaryImage = getPrimaryImage(req.files);
        const result = await client.query(`
            INSERT INTO "Events" (title, description, location_name, latitude, longitude, created_by, image_url, requires_approval, ticket_price, currency)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
        `, [
            data.title || null, data.description || null, data.locationName || null,
            data.latitude, data.longitude, req.user.id,
            primaryImage, data.requiresApproval,
            data.ticketPrice, data.currency
        ]);
        const eventId = result.rows[0].id;
        await insertTimeSlots(client, eventId, data.timeSlots, data.date);
        await insertEventMedia(client, eventId, req.files);
        await client.query('COMMIT');

        invalidateEventCaches(eventId);

        res.status(201).json(mapToCamelCase(result.rows[0]));
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('DEBUG: Create Event ERROR:', error);
        res.status(500).json({ message: 'Server error during event creation' });
    } finally {
        client.release();
    }
};

const performUpdate = async (client, eventId, data, files) => {
    let params = [
        data.title, data.description, data.locationName,
        data.latitude, data.longitude, data.requiresApproval,
        data.ticketPrice, data.currency
    ];
    let sql = `UPDATE "Events" SET title=$1, description=$2, location_name=$3, latitude=$4, longitude=$5, requires_approval=$6, ticket_price=$7, currency=$8`;
    let paramCount = 8;

    if (files && files.length > 0) {
        const firstImg = files.find(fi => fi.mimetype.startsWith('image/'));
        if (firstImg) {
            const imageUrl = process.env.USE_LOCAL_STORAGE === 'true' ? firstImg.filename : firstImg.path;
            paramCount++;
            sql += `, image_url = $${paramCount}`;
            params.push(imageUrl);
        }
    }

    paramCount++;
    sql += ` WHERE id = $${paramCount}`;
    params.push(eventId);

    await client.query(sql, params);

    if (data.timeSlots) {
        await client.query('DELETE FROM "EventTimeSlots" WHERE event_id = $1', [eventId]);
        await insertTimeSlots(client, eventId, data.timeSlots);
    }

    if (files && files.length > 0) {
        await client.query('DELETE FROM "EventMedia" WHERE event_id = $1', [eventId]);
        await insertEventMedia(client, eventId, files);
    }
};

const updateEvent = async (req, res) => {
    const eventId = req.params.id;
    const data = normalizeEventData(req.body);
    const pool = await poolPromise;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await performUpdate(client, eventId, data, req.files);
        await client.query('COMMIT');

        invalidateEventCaches(eventId);

        res.json({ message: 'Updated' });
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error("DEBUG: Update Event Failed:", error);
        res.status(500).json({ message: `Server error: ${error.message}` });
    } finally {
        if (client) client.release();
    }
};

const registerForEvent = async (req, res) => {
    try {
        // Authentication required — guests can no longer register
        if (!req.user) return res.status(401).json({ message: 'Login required to register for events' });

        const { timeSlotId, time_slot_id: timeSlotIdSnake } = req.body;
        const slotIdToUse = timeSlotId || timeSlotIdSnake;
        const pool = await poolPromise;
        const eventRes = await pool.query('SELECT * FROM "Events" WHERE id = $1', [req.params.id]);
        if (eventRes.rows.length === 0) return res.status(404).json({ message: 'Not found' });
        const event = eventRes.rows[0];

        let slotId = slotIdToUse;
        if (!slotId) {
            const s = await pool.query('SELECT id FROM "EventTimeSlots" WHERE event_id = $1 ORDER BY start_time ASC LIMIT 1', [event.id]);
            if (s.rows.length > 0) slotId = s.rows[0].id;
        }

        // Check if already registered
        const existingReg = await pool.query(`SELECT status FROM "Registrations" WHERE user_id = $1 AND time_slot_id = $2`, [req.user.id, slotId]);

        let currentStatus;
        if (existingReg.rows.length > 0) {
            const regRes = await pool.query(`
                UPDATE "Registrations" SET status = $1 
                WHERE user_id = $2 AND time_slot_id = $3
                RETURNING status, id
            `, [event.requires_approval ? 'pending' : 'approved', req.user.id, slotId]);
            currentStatus = regRes.rows[0].status;
        } else {
            const regRes = await pool.query(`
                INSERT INTO "Registrations" (user_id, event_id, time_slot_id, status) 
                VALUES ($1, $2, $3, $4)
                RETURNING status, id
            `, [req.user.id, event.id, slotId, event.requires_approval ? 'pending' : 'approved']);
            currentStatus = regRes.rows[0].status;
        }

        const u = await pool.query('SELECT email FROM "Users" WHERE id = $1', [req.user.id]);
        if (u.rows.length > 0 && currentStatus === 'approved') sendConfirmationEmail(u.rows[0].email, event);

        invalidateEventCaches(req.params.id);

        res.json({ message: 'Registered' });
    } catch (e) {
        console.error('Registration failed:', e);
        res.status(500).json({ message: 'Registration failed' });
    }
};

const deregisterFromEvent = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Login required' });

        const slotId = req.body.timeSlotId || req.body.time_slot_id || req.query.timeSlotId || req.query.time_slot_id;
        const pool = await poolPromise;

        let sql = 'DELETE FROM "Registrations" WHERE user_id = $1 AND event_id = $2';
        let params = [req.user.id, req.params.id];
        if (slotId) { sql += ' AND time_slot_id = $3'; params.push(slotId); }
        const r = await pool.query(sql, params);

        if (r.rowCount === 0) return res.status(404).json({ message: 'Not found' });

        invalidateEventCaches(req.params.id);

        res.json({ message: 'Deregistered' });
    } catch (e) { console.error(e); res.status(500).json({ message: 'Error' }); }
};

const getAttendees = async (req, res) => {
    try {
        const pool = await poolPromise;
        const r = await pool.query(`
            SELECT 
                u.id, 
                u.username, 
                u.email, 
                r.status, 
                r.registration_date as created_at, 
                r.check_in_time,
                ts.start_time as time_slot
            FROM "Registrations" r 
            JOIN "Users" u ON r.user_id = u.id 
            LEFT JOIN "EventTimeSlots" ts ON r.time_slot_id = ts.id 
            WHERE r.event_id = $1 
            ORDER BY r.registration_date DESC
        `, [req.params.id]);
        res.json(mapToCamelCase(r.rows));
    } catch (e) { console.error(e); res.status(500).json({ message: 'Error' }); }
};

const updateAttendeeStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!['pending', 'approved', 'rejected'].includes(status)) return res.status(400).json({ message: 'Invalid' });
        const pool = await poolPromise;
        const r = await pool.query('UPDATE "Registrations" SET status = $1 WHERE user_id = $2 AND event_id = $3', [status, req.params.userId, req.params.id]);
        if (r.rowCount === 0) return res.status(404).json({ message: 'Not found' });
        
        invalidateEventCaches(req.params.id);

        res.json({ message: 'Updated' });
    } catch (e) { console.error(e); res.status(500).json({ message: 'Error' }); }
};

const deleteEvent = async (req, res) => {
    try {
        const pool = await poolPromise;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const id = req.params.id;
            await client.query('DELETE FROM "EventMedia" WHERE event_id = $1', [id]);
            await client.query('DELETE FROM "Messages" WHERE event_id = $1', [id]);
            await client.query('DELETE FROM "GroupMessages" WHERE event_id = $1', [id]);
            await client.query('DELETE FROM "Registrations" WHERE event_id = $1', [id]);
            await client.query('DELETE FROM "EventTimeSlots" WHERE event_id = $1', [id]);
            await client.query('DELETE FROM "Events" WHERE id = $1', [id]);
            await client.query('COMMIT');

            invalidateEventCaches(id);

            res.json({ message: 'Deleted' });
        } catch (err) { await client.query('ROLLBACK'); throw err; }
        finally { client.release(); }
    } catch (e) { console.error(e); res.status(500).json({ message: 'Error' }); }
};

const getEventMemories = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.query(`
            SELECT em.id, em.image_url as "imageUrl", em.created_at as "createdAt", u.username as "uploaderName"
            FROM "EventMemories" em
            JOIN "Users" u ON em.user_id = u.id
            WHERE em.event_id = $1
            ORDER BY em.created_at DESC
        `, [req.params.id]);
        res.json(result.rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Server error' });
    }
};

const addEventMemory = async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!req.files || req.files.length === 0) {
            console.warn('Memory Upload: No image provided');
            return res.status(400).json({ message: 'No image provided' });
        }

        const file = req.files[0];
        const imageUrl = process.env.USE_LOCAL_STORAGE === 'true' ? file.filename : file.path;

        const eventId = parseInt(req.params.id);
        const userId = parseInt(req.user.id);

        console.log(`Memory Upload: Event ${eventId}, User ${userId}, Image ${imageUrl}`);

        await pool.query(
            'INSERT INTO "EventMemories" (event_id, user_id, image_url) VALUES ($1, $2, $3)',
            [eventId, userId, imageUrl]
        );

        res.json({ success: true, message: 'Memory uploaded successfully' });
    } catch (e) {
        console.error('Memory Upload Error:', e.message);
        res.status(500).json({ message: 'Server error during memory upload: ' + e.message });
    }
};

module.exports = {
    getAllEvents,
    getRegisteredEvents,
    getHostedEvents,
    getEventById,
    createEvent,
    updateEvent,
    registerForEvent,
    deregisterFromEvent,
    getAttendees,
    updateAttendeeStatus,
    deleteEvent,
    getEventMemories,
    addEventMemory
};
