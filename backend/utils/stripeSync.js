const { poolPromise } = require('../config/db');

/**
 * Syncs a user's pending transactions with Stripe.
 * Great for local dev where webhooks don't work!
 */
const syncPendingTransactions = async (userId) => {
    if (!process.env.STRIPE_SECRET_KEY) return;

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const pool = await poolPromise;

    try {
        const result = await pool.query(`
            SELECT pt.*, e.requires_approval
            FROM "PaymentTransactions" pt
            JOIN "Events" e ON pt.event_id = e.id
            WHERE pt.user_id = $1 AND pt.status = 'pending'
        `, [userId]);

        for (let transaction of result.rows) {
            console.log(`🔄 [Auto-Sync] checking Stripe for session ${transaction.stripe_session_id}`);
            const session = await stripe.checkout.sessions.retrieve(transaction.stripe_session_id);

            if (session.payment_status === 'paid') {
                console.log(`✅ [Auto-Sync] Found PAID session! Updating DB...`);

                await pool.query(`
                    UPDATE "PaymentTransactions"
                    SET status = 'paid', stripe_payment_intent_id = $1
                    WHERE stripe_session_id = $2
                `, [session.payment_intent, transaction.stripe_session_id]);

                const { eventId, userId: metadataUserId, timeSlotId } = session.metadata;
                const parsedEventId = parseInt(eventId);
                const parsedUserId = parseInt(metadataUserId) || userId;

                if (isNaN(parsedEventId)) {
                    console.log(`⚠️  [Auto-Sync] Skipping session ${transaction.stripe_session_id}: Invalid eventId in metadata`);
                    continue;
                }

                let finalTimeId = timeSlotId ? parseInt(timeSlotId) : null;

                if (!finalTimeId || isNaN(finalTimeId)) {
                    const slots = await pool.query('SELECT id FROM "EventTimeSlots" WHERE event_id = $1 ORDER BY start_time ASC LIMIT 1', [parsedEventId]);
                    finalTimeId = slots.rows[0]?.id;
                }

                if (finalTimeId) {
                    // Payment confirmed by Stripe = always approve. requires_approval only gates free events.
                    await pool.query(`
                        INSERT INTO "Registrations" (user_id, event_id, time_slot_id, status)
                        VALUES ($1, $2, $3, 'approved')
                        ON CONFLICT (user_id, time_slot_id) WHERE user_id IS NOT NULL DO UPDATE SET status = 'approved'
                    `, [parsedUserId, parsedEventId, finalTimeId]);
                    console.log(`✓ Registration synced (APPROVED) for user ${parsedUserId} to event ${parsedEventId}`);
                    
                    // Invalidate cache so attendee count updates visually on frontend
                    const cacheService = require('../utils/cacheService');
                    cacheService.del(`event_${parsedEventId}`);
                    cacheService.del('all_events_upcoming');
                    cacheService.del('all_events_past');
                }
            }
        }
    } catch (error) {
        console.error('Failed to auto-sync transactions:', error.message);
    }
};

module.exports = { syncPendingTransactions };
