const cacheService = require('./cacheService');

/**
 * Common cache invalidation keys for event-related changes.
 * When an event is updated, deleted, or registration status changes,
 * we need to clear the specific event and the global lists (upcoming/past).
 */
const invalidateEventCaches = (eventId) => {
    if (eventId) {
        cacheService.del(`event_${eventId}`);
    }
    cacheService.del('all_events_upcoming');
    cacheService.del('all_events_past');
};

module.exports = {
    invalidateEventCaches
};
