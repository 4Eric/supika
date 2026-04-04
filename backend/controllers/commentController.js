const { poolPromise } = require('../config/db');

exports.getComments = async (req, res) => {
    try {
        const pool = await poolPromise;
        const { id } = req.params;
        const userId = req.user ? req.user.id : null;

        // Fetch comments with user details and likes count
        const query = `
            SELECT 
                c.id, c."eventId", c."userId", c."parentId", c."content", c."createdAt",
                u.username as "username", u.avatar_url as "avatarUrl",
                COUNT(l.id) as "likesCount",
                EXISTS(SELECT 1 FROM "EventCommentLikes" cl WHERE cl."commentId" = c.id AND cl."userId" = $2::int) as "isLikedByMe",
                e.created_by as "eventCreatorId"
            FROM "EventComments" c
            JOIN "Users" u ON c."userId" = u.id
            JOIN "Events" e ON c."eventId" = e.id
            LEFT JOIN "EventCommentLikes" l ON c.id = l."commentId"
            WHERE c."eventId" = $1
            GROUP BY c.id, u.username, u.avatar_url, e.created_by
        `;
        const result = await pool.query(query, [id, userId]);

        // Transform flat list to nested tree
        const comments = result.rows;
        const commentMap = {};
        const rootComments = [];

        comments.forEach(comment => {
            comment.replies = [];
            comment.likesCount = parseInt(comment.likesCount, 10);
            commentMap[comment.id] = comment;
        });

        comments.forEach(comment => {
            if (comment.parentId) {
                if (commentMap[comment.parentId]) {
                    commentMap[comment.parentId].replies.push(comment);
                } else {
                    rootComments.push(comment);
                }
            } else {
                rootComments.push(comment);
            }
        });

        // 1. Sort nested replies (Chronological / Oldest first for natural conversation flow)
        Object.values(commentMap).forEach(comment => {
            comment.replies.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        });

        // 2. Sort Root Comments (TikTok Algorithm: Host -> Likes -> Newest)
        rootComments.sort((a, b) => {
            const isAHost = a.userId === a.eventCreatorId;
            const isBHost = b.userId === b.eventCreatorId;

            // Priority 1: Host/Organizer pinned
            if (isAHost && !isBHost) return -1;
            if (!isAHost && isBHost) return 1;

            // Priority 2: Most Liked
            if (b.likesCount !== a.likesCount) {
                return b.likesCount - a.likesCount;
            }

            // Priority 3: Newest First
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        res.json(rootComments);
    } catch (err) {
        console.error('Error fetching comments:', err);
        require('fs').writeFileSync('err.txt', err.stack || err.message);
        res.status(500).json({ message: 'Server error fetching comments' });
    }
};

exports.addComment = async (req, res) => {
    try {
        const pool = await poolPromise;
        const { id } = req.params;
        const { content, parentId } = req.body;
        const userId = req.user.id;

        if (!content || !content.trim()) {
            return res.status(400).json({ message: 'Comment content is required' });
        }

        const query = `
            INSERT INTO "EventComments" ("eventId", "userId", "content", "parentId")
            VALUES ($1, $2, $3, $4)
            RETURNING id, "eventId", "userId", "parentId", "content", "createdAt"
        `;
        
        const result = await pool.query(query, [id, userId, content, parentId || null]);
        
        // Fetch the user data to return a fully populated comment
        const userQuery = `SELECT username, avatar_url as "avatarUrl" FROM "Users" WHERE id = $1`;
        const userResult = await pool.query(userQuery, [userId]);
        
        const newComment = {
            ...result.rows[0],
            username: userResult.rows[0].username,
            avatarUrl: userResult.rows[0].avatarUrl,
            likesCount: 0,
            isLikedByMe: false,
            replies: []
        };

        res.status(201).json(newComment);
    } catch (err) {
        console.error('Error adding comment:', err);
        res.status(500).json({ message: 'Server error adding comment' });
    }
};

exports.toggleLike = async (req, res) => {
    try {
        const pool = await poolPromise;
        const { commentId } = req.params;
        const userId = req.user.id;

        // Check if like exists
        const checkQuery = `SELECT id FROM "EventCommentLikes" WHERE "commentId" = $1 AND "userId" = $2`;
        const checkResult = await pool.query(checkQuery, [commentId, userId]);

        if (checkResult.rows.length > 0) {
            // Unlike
            await pool.query(`DELETE FROM "EventCommentLikes" WHERE "commentId" = $1 AND "userId" = $2`, [commentId, userId]);
            res.json({ liked: false });
        } else {
            // Like
            await pool.query(`INSERT INTO "EventCommentLikes" ("commentId", "userId") VALUES ($1, $2)`, [commentId, userId]);
            res.json({ liked: true });
        }
    } catch (err) {
        console.error('Error toggling like:', err);
        res.status(500).json({ message: 'Server error toggling like' });
    }
};
