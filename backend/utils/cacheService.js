const NodeCache = require('node-cache');

// stdTTL: 300 seconds (5 minutes)
// checkperiod: 60 seconds
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * Cache Wrapper Service
 */
const cacheService = {
    get: (key) => cache.get(key),
    set: (key, value, ttl) => cache.set(key, value, ttl),
    del: (key) => cache.del(key),
    flush: () => cache.flushAll(),

    /**
     * Mutate an event in the 'all_events' cache list
     * @param {number} eventId 
     * @param {Object} changes - Key value pairs to update
     */
    mutateEventInList: (eventId, changes) => {
        const events = cache.get('all_events');
        if (events && Array.isArray(events)) {
            const index = events.findIndex(e => e.id === eventId);
            if (index !== -1) {
                events[index] = { ...events[index], ...changes };
                cache.set('all_events', events);
                return true;
            }
        }
        return false;
    }
};

module.exports = cacheService;
