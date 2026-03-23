const getStripe = () => {
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('...')) {
        throw new Error('STRIPE_SECRET_KEY is missing or contains placeholder. Please configure it in .env');
    }
    return require('stripe')(process.env.STRIPE_SECRET_KEY);
};
const { poolPromise } = require('../config/db');

/**
 * Create a Stripe Checkout Session for buying a ticket
 */
const createCheckoutSession = async (req, res) => {
    try {
        const { eventId, timeSlotId } = req.body;
        const userId = req.user.id;

        // Use the request origin so that mobile devices (192.168.x.x) get
        // redirected back to their correct host, not localhost.
        const frontendUrl = req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:5173';

        const pool = await poolPromise;
        const result = await pool.query('SELECT * FROM "Events" WHERE id = $1', [eventId]);
        const event = result.rows[0];

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        if (event.ticket_price <= 0) {
            return res.status(400).json({ message: 'This event is free' });
        }

        const platformFeePercent = parseFloat(process.env.STRIPE_PLATFORM_FEE_PERCENT) || 7;
        const amountTotal = Math.round(event.ticket_price * 100); // converting to cents
        const platformFeeAmount = Math.round(amountTotal * (platformFeePercent / 100));

        // Create the session
        const session = await getStripe().checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: event.currency || 'CAD',
                    product_data: {
                        name: `${event.title} - Ticket`,
                        description: `Ticket for the event: ${event.title}`,
                        images: event.image_url ? [event.image_url] : [],
                    },
                    unit_amount: amountTotal,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${frontendUrl}/ticket-confirmation?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${frontendUrl}/event/${eventId}`,
            metadata: {
                eventId: eventId.toString(),
                userId: userId.toString(),
                timeSlotId: timeSlotId ? timeSlotId.toString() : '',
            },
        });

        // Store pending transaction in DB
        await pool.query(`
            INSERT INTO "PaymentTransactions" (event_id, user_id, stripe_session_id, amount_total, platform_fee_amount, currency, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'pending')
        `, [eventId, userId, session.id, amountTotal, platformFeeAmount, event.currency || 'CAD']);

        res.json({ url: session.url });
    } catch (error) {
        console.error('Checkout error detail:', {
            message: error.message,
            stack: error.stack,
            type: error.type,
            raw: error.raw
        });
        res.status(500).json({
            message: 'Failed to create checkout session'
        });
    }
};

/**
 * Stripe Webhook Handler
 */
const handleWebhook = async (req, res) => {
    const signature = req.headers['stripe-signature'];
    let event;

    try {
        event = getStripe().webhooks.constructEvent(
            req.body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const pool = await poolPromise;

    // Handle checkout session completion
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const paymentIntentId = session.payment_intent;
        const stripeSessionId = session.id;

        try {
            // Update transaction status
            await pool.query(`
                UPDATE "PaymentTransactions"
                SET status = 'paid', stripe_payment_intent_id = $1
                WHERE stripe_session_id = $2
            `, [paymentIntentId, stripeSessionId]);

            // Create Registration
            const { eventId, userId, timeSlotId } = session.metadata;
            const parsedEventId = parseInt(eventId);
            const parsedUserId = parseInt(userId);

            let finalTimeSlotId = timeSlotId ? parseInt(timeSlotId) : null;
            if (!finalTimeSlotId) {
                // Fallback: Get the first available time slot for this event
                const slots = await pool.query('SELECT id FROM "EventTimeSlots" WHERE event_id = $1 LIMIT 1', [parsedEventId]);
                finalTimeSlotId = slots.rows[0]?.id;
            }

            if (finalTimeSlotId) {
                await pool.query(`
                    INSERT INTO "Registrations" (user_id, event_id, time_slot_id, status)
                    VALUES ($1, $2, $3, 'approved')
                    ON CONFLICT (user_id, time_slot_id) WHERE user_id IS NOT NULL DO UPDATE SET status = 'approved'
                `, [parsedUserId, parsedEventId, finalTimeSlotId]);
                console.log(`✓ Registration created/updated for user ${parsedUserId} at event ${parsedEventId} (Slot ${finalTimeSlotId})`);
                
                const { invalidateEventCaches } = require('../utils/cacheHelper');
                invalidateEventCaches(parsedEventId);
            }

        } catch (dbError) {
            console.error('Error processing webhook DB updates:', dbError);
            return res.status(500).json({ message: 'Database update failed' });
        }
    }

    res.status(200).json({ received: true });
};

/**
 * Get transaction status from DB
 */
const getTransactionStatus = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const pool = await poolPromise;

        // 1. Check local DB first
        const result = await pool.query(`
            SELECT pt.*, e.title as event_title, e.id as event_id, e.requires_approval
            FROM "PaymentTransactions" pt
            JOIN "Events" e ON pt.event_id = e.id
            WHERE pt.stripe_session_id = $1
        `, [sessionId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        let transaction = result.rows[0];

        // 2. If DB says pending, let's perform a "Heartbeat Sync" with Stripe
        // This makes it work locally even without a webhook tunnel!
        if (transaction.status === 'pending') {
            console.log(`🔄 Syncing pending transaction ${sessionId} with Stripe...`);
            const session = await getStripe().checkout.sessions.retrieve(sessionId);

            if (session.payment_status === 'paid') {
                console.log(`✅ Stripe says PAID! Manually confirming for session ${sessionId}`);

                // Update local DB status
                await pool.query(`
                    UPDATE "PaymentTransactions"
                    SET status = 'paid', stripe_payment_intent_id = $1
                    WHERE stripe_session_id = $2
                `, [session.payment_intent, sessionId]);

                // Create the registration
                const { eventId, userId, timeSlotId } = session.metadata;
                let finalTimeSlotId = timeSlotId;

                if (!finalTimeSlotId) {
                    const slots = await pool.query('SELECT id FROM "EventTimeSlots" WHERE event_id = $1 LIMIT 1', [eventId]);
                    finalTimeSlotId = slots.rows[0]?.id;
                }

                if (finalTimeSlotId) {
                    // Payment is confirmed by Stripe - always approve regardless of requires_approval
                    // The requires_approval flag only gates FREE event registrations.
                    // For paid events, completing payment IS the approval.
                    await pool.query(`
                        INSERT INTO "Registrations" (user_id, event_id, time_slot_id, status)
                        VALUES ($1, $2, $3, 'approved')
                        ON CONFLICT (user_id, time_slot_id) WHERE user_id IS NOT NULL DO UPDATE SET status = 'approved'
                    `, [parseInt(userId), parseInt(eventId), parseInt(finalTimeSlotId)]);
                    console.log(`✓ Registration auto-synced (APPROVED) for user ${userId} to event ${eventId}`);
                    
                    const { invalidateEventCaches } = require('../utils/cacheHelper');
                    invalidateEventCaches(eventId);
                }

                // Refresh local transaction object to send back
                transaction.status = 'paid';
            }
        }

        res.json(transaction);
    } catch (error) {
        console.error('Get status error:', error);
        res.status(500).json({ message: 'Error fetching transaction' });
    }
}

/**
 * Cancel a paid ticket and issue a full Stripe refund
 */
const createRefund = async (req, res) => {
    try {
        const { eventId, timeSlotId } = req.body;
        const userId = req.user.id;
        const pool = await poolPromise;

        // 1. Find the paid transaction for this user & event
        const txResult = await pool.query(`
            SELECT * FROM "PaymentTransactions"
            WHERE user_id = $1 AND event_id = $2 AND status = 'paid'
            ORDER BY created_at DESC LIMIT 1
        `, [userId, eventId]);

        if (txResult.rows.length === 0) {
            return res.status(404).json({ message: 'No paid transaction found for this event.' });
        }

        const tx = txResult.rows[0];

        if (!tx.stripe_payment_intent_id) {
            return res.status(400).json({ message: 'Cannot refund: Stripe payment intent not found on record.' });
        }

        // 2. Issue the Stripe refund
        const stripe = getStripe();
        const refund = await stripe.refunds.create({
            payment_intent: tx.stripe_payment_intent_id,
        });

        console.log(`💸 Refund issued: ${refund.id} for payment_intent ${tx.stripe_payment_intent_id}`);

        // 3. Update transaction status to refunded in DB
        await pool.query(`
            UPDATE "PaymentTransactions"
            SET status = 'refunded', stripe_refund_id = $1
            WHERE id = $2
        `, [refund.id, tx.id]);

        // 4. Delete the registration
        if (timeSlotId) {
            await pool.query(
                'DELETE FROM "Registrations" WHERE user_id = $1 AND event_id = $2 AND time_slot_id = $3',
                [userId, eventId, timeSlotId]
            );
        } else {
            await pool.query(
                'DELETE FROM "Registrations" WHERE user_id = $1 AND event_id = $2',
                [userId, eventId]
            );
        }

        const { invalidateEventCaches } = require('../utils/cacheHelper');
        invalidateEventCaches(eventId);

        res.json({ success: true, refundId: refund.id, message: 'Refund issued successfully. It may take 5–10 business days to appear.' });
    } catch (error) {
        console.error('Refund error:', error);
        // Surface Stripe-specific error messages
        const msg = error.raw?.message || error.message || 'Failed to process refund.';
        res.status(500).json({ message: msg });
    }
};

module.exports = {
    createCheckoutSession,
    handleWebhook,
    getTransactionStatus,
    createRefund
};
