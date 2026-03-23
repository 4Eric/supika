const { poolPromise } = require('../config/db');
const { mapToCamelCase } = require('../utils/mapper');
const cacheService = require('../utils/cacheService');

const getPublicProfile = async (req, res) => {
    try {
        const pool = await poolPromise;
        const userId = req.params.id;

        const currentUserId = req.user ? req.user.id : null;

        // Fetch user basic info
        const userResult = await pool.query(`
            SELECT id, username, created_at,
            (SELECT COUNT(*) FROM "Events" WHERE created_by = $1) as events_hosted_count,
            (SELECT COUNT(*) FROM "Registrations" r JOIN "Events" e ON r.event_id = e.id WHERE e.created_by = $1 AND (r.status = 'approved' OR r.status IS NULL)) as total_attendees_count,
            (SELECT COUNT(*) FROM "UserFollowers" WHERE following_id = $1) as followers_count,
            (SELECT COUNT(*) FROM "UserFollowers" WHERE follower_id = $1) as following_count
            FROM "Users"
            WHERE id = $1
        `, [userId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        let isFollowing = false;
        if (req.header('x-auth-token')) {
            // Need a fast way to check verify without full middleware, we'll try catching the header
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(req.header('x-auth-token'), process.env.JWT_SECRET);
                const selfId = decoded.user.id;
                const followCheck = await pool.query('SELECT 1 FROM "UserFollowers" WHERE follower_id = $1 AND following_id = $2', [selfId, userId]);
                isFollowing = followCheck.rowCount > 0;
            } catch (e) { }
        }

        const data = mapToCamelCase(userResult.rows[0]);
        data.isFollowing = isFollowing;

        res.json(data);
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

const followUser = async (req, res) => {
    try {
        const pool = await poolPromise;
        const followerId = req.user.id;
        const followingId = req.params.id;

        if (followerId == followingId) return res.status(400).json({ message: 'Cannot follow yourself' });

        await pool.query('INSERT INTO "UserFollowers" (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [followerId, followingId]);
        res.json({ success: true, message: 'Followed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const unfollowUser = async (req, res) => {
    try {
        const pool = await poolPromise;
        const followerId = req.user.id;
        const followingId = req.params.id;

        await pool.query('DELETE FROM "UserFollowers" WHERE follower_id = $1 AND following_id = $2', [followerId, followingId]);
        res.json({ success: true, message: 'Unfollowed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getFollowers = async (req, res) => {
    try {
        const pool = await poolPromise;
        const userId = req.params.id;
        const type = req.query.type === 'following' ? 'following_id' : 'follower_id';
        const joinField = type === 'following_id' ? 'follower_id' : 'following_id';

        // if type is following, we want to see who this userId follows 
        const result = await pool.query(`
            SELECT u.id, u.username FROM "UserFollowers" uf
            JOIN "Users" u ON uf.${joinField} = u.id
            WHERE uf.${type} = $1
        `, [userId]);

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getPublicProfile,
    getUserEvents,
    followUser,
    unfollowUser,
    getFollowers
};
