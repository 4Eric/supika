const { poolPromise } = require('../config/db');
const { mapToCamelCase } = require('../utils/mapper');
const { sendConfirmationEmail } = require('../utils/mailer');

const getAllEvents = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const pool = await poolPromise;
        const result = await pool.query(`
            SELECT e.*, u.username as creator_name,
            (SELECT MIN(start_time) FROM "EventTimeSlots" ts WHERE ts.event_id = e.id) AS date,
            (SELECT COUNT(*) FROM "Registrations" r JOIN "EventTimeSlots" ts ON r.time_slot_id = ts.id WHERE ts.event_id = e.id AND (r.status = 'approved' OR r.status IS NULL)) AS attendee_count
            FROM "Events" e 
            LEFT JOIN "Users" u ON e.created_by = u.id 
            ORDER BY (SELECT MIN(start_time) FROM "EventTimeSlots" ts WHERE ts.event_id = e.id) ASC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);
        res.json(mapToCamelCase(result.rows));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getRegisteredEvents = async (req, res) => {
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
        res.json(mapToCamelCase(event));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
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
        await client.query(`
            INSERT INTO "EventTimeSlots" (event_id, start_time, duration_minutes, max_attendees)
            VALUES ($1, $2, $3, $4)
        `, [eventId, new Date(slot.start_time).toISOString(), parseInt(slot.duration_minutes) || 60, parseInt(slot.max_attendees) || 5]);
    }
};

const insertEventMedia = async (client, eventId, files) => {
    if (!files || files.length === 0) return;
    for (let file of files) {
        const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
        const mediaUrl = process.env.USE_LOCAL_STORAGE === 'true' ? file.filename : file.path;
        await client.query(`
            INSERT INTO "EventMedia" (event_id, media_url, media_type)
            VALUES ($1, $2, $3)
        `, [eventId, mediaUrl, mediaType]);
    }
};

const createEvent = async (req, res) => {
    const {
        title,
        description,
        locationName,
        location_name,
        latitude,
        longitude,
        requiresApproval,
        requires_approval,
        timeSlots,
        time_slots,
        date
    } = req.body;

    // Support both cases
    const locName = locationName || location_name;
    const reqApproval = (requiresApproval !== undefined) ? requiresApproval : requires_approval;
    const tSlots = timeSlots || time_slots;
    const pool = await poolPromise;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let primaryImage = 'default_event.png';
        if (req.files && req.files.length > 0) {
            const firstImg = req.files.find(f => f.mimetype.startsWith('image/'));
            if (firstImg) primaryImage = process.env.USE_LOCAL_STORAGE === 'true' ? firstImg.filename : firstImg.path;
        }
        const result = await client.query(`
            INSERT INTO "Events" (title, description, location_name, latitude, longitude, created_by, image_url, requires_approval)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
        `, [title, description, locName, parseFloat(latitude) || null, parseFloat(longitude) || null, req.user.id, primaryImage, reqApproval === 'true' || reqApproval === true]);
        const eventId = result.rows[0].id;
        await insertTimeSlots(client, eventId, tSlots, date);
        await insertEventMedia(client, eventId, req.files);
        await client.query('COMMIT');
        res.status(201).json(mapToCamelCase(result.rows[0]));
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};

const updateEvent = async (req, res) => {
    const eventId = req.params.id;
    const {
        title,
        description,
        locationName,
        location_name: locationNameSnake,
        latitude,
        longitude,
        requiresApproval,
        requires_approval: requiresApprovalSnake,
        timeSlots,
        time_slots: timeSlotsSnake
    } = req.body;

    const locName = locationName || locationNameSnake;
    const reqApproval = (requiresApproval !== undefined) ? requiresApproval : requiresApprovalSnake;
    const tSlots = timeSlots || timeSlotsSnake;
    const pool = await poolPromise;
    const client = await pool.connect();
    try {
        const check = await pool.query('SELECT created_by FROM "Events" WHERE id = $1', [eventId]);
        if (check.rows.length === 0) return res.status(404).json({ message: 'Event not found' });
        if (check.rows[0].created_by != req.user.id) return res.status(403).json({ message: 'Unauthorized' });
        await client.query('BEGIN');
        let imgSql = "", params = [title, description, locName, parseFloat(latitude) || null, parseFloat(longitude) || null, reqApproval === 'true' || reqApproval === true, eventId];
        if (req.files && req.files.length > 0) {
            const f = req.files.find(fi => fi.mimetype.startsWith('image/'));
            if (f) { imgSql = `, image_url = $8`; params.push(process.env.USE_LOCAL_STORAGE === 'true' ? f.filename : f.path); }
        }
        await client.query(`UPDATE "Events" SET title=$1, description=$2, location_name=$3, latitude=$4, longitude=$5, requires_approval=$6 ${imgSql} WHERE id=$7`, params);
        if (tSlots) { await client.query('DELETE FROM "EventTimeSlots" WHERE event_id = $1', [eventId]); await insertTimeSlots(client, eventId, tSlots); }
        if (req.files && req.files.length > 0) { await client.query('DELETE FROM "EventMedia" WHERE event_id = $1', [eventId]); await insertEventMedia(client, eventId, req.files); }
        await client.query('COMMIT');
        res.json({ message: 'Updated' });
    } catch (error) { await client.query('ROLLBACK'); console.error(error); res.status(500).json({ message: 'Error' }); }
    finally { client.release(); }
};

const registerForEvent = async (req, res) => {
    try {
        console.log('Register Request Body:', req.body);
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
        await pool.query('INSERT INTO "Registrations" (user_id, event_id, time_slot_id, status) VALUES ($1, $2, $3, $4)', [req.user.id, event.id, slotId, event.requires_approval ? 'pending' : 'approved']);
        const u = await pool.query('SELECT email FROM "Users" WHERE id = $1', [req.user.id]);
        if (u.rows.length > 0) sendConfirmationEmail(u.rows[0].email, event);
        res.json({ message: 'Registered' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Error: ' + e.message, detail: e.detail });
    }
};

const deregisterFromEvent = async (req, res) => {
    try {
        const slotId = req.body.timeSlotId || req.body.time_slot_id || req.query.timeSlotId || req.query.time_slot_id;
        const pool = await poolPromise;
        let sql = 'DELETE FROM "Registrations" WHERE user_id = $1 AND event_id = $2', params = [req.user.id, req.params.id];
        if (slotId) { sql += ' AND time_slot_id = $3'; params.push(slotId); }
        const r = await pool.query(sql, params);
        if (r.rowCount === 0) return res.status(404).json({ message: 'Not found' });
        res.json({ message: 'Deregistered' });
    } catch (e) { console.error(e); res.status(500).json({ message: 'Error' }); }
};

const getAttendees = async (req, res) => {
    try {
        const pool = await poolPromise;
        const check = await pool.query('SELECT created_by FROM "Events" WHERE id = $1', [req.params.id]);
        if (check.rows.length === 0) return res.status(404).json({ message: 'Not found' });
        if (check.rows[0].created_by != req.user.id) return res.status(403).json({ message: 'Unauthorized' });
        const r = await pool.query('SELECT u.id, u.username, u.email, r.status, r.registration_date as created_at, ts.start_time as time_slot FROM "Registrations" r JOIN "Users" u ON r.user_id = u.id LEFT JOIN "EventTimeSlots" ts ON r.time_slot_id = ts.id WHERE r.event_id = $1 ORDER BY r.registration_date DESC', [req.params.id]);
        res.json(mapToCamelCase(r.rows));
    } catch (e) { console.error(e); res.status(500).json({ message: 'Error' }); }
};

const updateAttendeeStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!['pending', 'approved', 'rejected'].includes(status)) return res.status(400).json({ message: 'Invalid' });
        const pool = await poolPromise;
        const check = await pool.query('SELECT created_by FROM "Events" WHERE id = $1', [req.params.id]);
        if (check.rows.length === 0) return res.status(404).json({ message: 'Not found' });
        if (check.rows[0].created_by != req.user.id) return res.status(403).json({ message: 'Unauthorized' });
        const r = await pool.query('UPDATE "Registrations" SET status = $1 WHERE user_id = $2 AND event_id = $3', [status, req.params.userId, req.params.id]);
        if (r.rowCount === 0) return res.status(404).json({ message: 'Not found' });
        res.json({ message: 'Updated' });
    } catch (e) { console.error(e); res.status(500).json({ message: 'Error' }); }
};

const deleteEvent = async (req, res) => {
    try {
        const pool = await poolPromise;
        const check = await pool.query('SELECT created_by FROM "Events" WHERE id = $1', [req.params.id]);
        if (check.rows.length === 0) return res.status(404).json({ message: 'Not found' });
        if (check.rows[0].created_by != req.user.id) return res.status(403).json({ message: 'Unauthorized' });
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
            res.json({ message: 'Deleted' });
        } catch (err) { await client.query('ROLLBACK'); throw err; }
        finally { client.release(); }
    } catch (e) { console.error(e); res.status(500).json({ message: 'Error' }); }
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
    deleteEvent
};
