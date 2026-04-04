const { GoogleGenerativeAI } = require('@google/generative-ai');
const { poolPromise } = require('../config/db');
const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const EFINDER_USER_ID = parseInt(process.env.EFINDER_USER_ID);

/**
 * AI Event Discovery Service
 * Uses Gemini to search the web for real events and extract structured data.
 * Returns 1 event per request to minimize token usage.
 */

// Geocode a location name → lat/lng using Nominatim (with progressive fallback)
async function geocode(locationName) {
    // Build progressively simpler search strings
    const attempts = [
        locationName,
        locationName.replace(/[&]/g, 'and'),  // M&S → M and S
        locationName.replace(/,\s*[A-Z0-9]{2,4}\s*[A-Z0-9]{3}$/i, ''), // strip UK postcode
        // Take just the last 2 comma-separated parts (city-level)
        locationName.split(',').slice(-2).join(',').trim(),
        // Take just the last part (city only)
        locationName.split(',').pop().trim()
    ].filter(Boolean);

    for (const q of attempts) {
        try {
            const res = await axios.get('https://nominatim.openstreetmap.org/search', {
                params: { q, format: 'json', limit: 1 },
                headers: { 'User-Agent': 'Supika/1.0 (efinder@supika.app)' }
            });
            if (res.data && res.data.length > 0) {
                console.log(`[eFinder] Geocoded "${q}" → ${res.data[0].lat}, ${res.data[0].lon}`);
                return { lat: parseFloat(res.data[0].lat), lng: parseFloat(res.data[0].lon) };
            }
        } catch (e) {
            console.warn(`[eFinder] Geocode attempt failed for "${q}":`, e.message);
        }
        // Nominatim rate limit: 1 req/sec
        await new Promise(r => setTimeout(r, 1100));
    }
    return null;
}

// Validate and resolve event image URL
const CATEGORY_KEYWORDS = {
    music: 'concert,live+music,stage',
    sports: 'stadium,sports,arena',
    art: 'art+gallery,exhibition,painting',
    tech: 'technology,conference,coding',
    food: 'food+festival,chef,cuisine',
    comedy: 'comedy,standup,microphone',
    theater: 'theater,stage,performance',
    festival: 'festival,crowd,celebration',
    other: 'event,celebration,city'
};

async function resolveEventImage(imageUrl, title, category) {
    // 1. Try the AI-provided URL
    if (imageUrl && imageUrl.startsWith('http')) {
        try {
            const res = await axios.head(imageUrl, {
                timeout: 5000,
                maxRedirects: 5,
                validateStatus: (s) => s < 400,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const contentType = res.headers['content-type'] || '';
            if (contentType.startsWith('image/')) {
                console.log(`[eFinder] Image URL verified: ${imageUrl}`);
                return imageUrl;
            }
        } catch (e) {
            console.warn(`[eFinder] Image URL broken: ${e.message}`);
        }
    }

    // 2. Fallback: use Unsplash source for a relevant image
    const cat = (category || 'other').toLowerCase();
    const keywords = CATEGORY_KEYWORDS[cat] || CATEGORY_KEYWORDS.other;
    const fallbackUrl = `https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&h=500&fit=crop`;
    // Try Unsplash search-based URL
    const unsplashUrl = `https://source.unsplash.com/800x500/?${keywords}`;
    try {
        const res = await axios.get(unsplashUrl, {
            maxRedirects: 5,
            timeout: 5000,
            validateStatus: (s) => s < 400,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        // Unsplash redirects to the actual image URL
        if (res.request?.res?.responseUrl) {
            console.log(`[eFinder] Using Unsplash image for category: ${cat}`);
            return res.request.res.responseUrl;
        }
    } catch (e) {
        console.warn(`[eFinder] Unsplash fallback failed: ${e.message}`);
    }

    // 3. Final fallback: a known working Unsplash image
    console.log(`[eFinder] Using default fallback image`);
    return fallbackUrl;
}

// Check for duplicate events in the DB
async function isDuplicate(pool, title, date, lat, lng) {
    const result = await pool.query(`
        SELECT e.id FROM "Events" e 
        JOIN "EventTimeSlots" ts ON ts.event_id = e.id
        WHERE LOWER(e.title) = LOWER($1)
        AND DATE(ts.start_time) = DATE($2::timestamp)
        AND ABS(e.latitude - $3) < 0.01
        AND ABS(e.longitude - $4) < 0.01
        LIMIT 1
    `, [title, date, lat, lng]);
    return result.rows.length > 0;
}

// Main discovery function
async function discoverEvents(query, options = {}) {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
    if (!EFINDER_USER_ID) throw new Error('EFINDER_USER_ID not set');

    const { lat, lng, radius } = options;

    // Build a location-aware prompt
    let locationContext = '';
    if (lat && lng) {
        // Reverse geocode to get a city name for the search
        try {
            const geoRes = await axios.get('https://nominatim.openstreetmap.org/reverse', {
                params: { lat, lon: lng, format: 'json' },
                headers: { 'User-Agent': 'Supika/1.0 (efinder@supika.app)' }
            });
            if (geoRes.data?.address) {
                const addr = geoRes.data.address;
                locationContext = addr.city || addr.town || addr.county || addr.state || '';
            }
        } catch (e) { /* ignore */ }
    }

    const searchQuery = locationContext
        ? `${query} in ${locationContext}`
        : query;

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

    const prompt = `Search the internet for exactly 1 real upcoming event matching: "${searchQuery}".

Return ONLY a JSON object (no markdown, no code blocks) in this exact format:
{
  "title": "Event Name",
  "description": "Brief description (2-3 sentences max)",
  "date": "YYYY-MM-DDTHH:MM:SS",
  "locationName": "Full venue address",
  "imageUrl": "Direct URL to the event poster image (optional, leave as empty string if not found)",
  "sourceUrl": "URL where you found this event (optional, leave empty if not found)",
  "category": "One of: music, sports, art, tech, food, comedy, theater, festival, pet, other"
}

Rules:
- The event MUST be real and upcoming (after today's date: ${new Date().toISOString().split('T')[0]})
- Include the full venue name and city in locationName
- Use ISO 8601 format for date
- For imageUrl, if you cannot find a direct image link ending in .jpg or .png, simply provide an empty string "". The system will provide a fallback. Do NOT refuse the request over missing images.
- Return ONLY the JSON, nothing else`;

    // Model fallback chain — try with search tool, then without
    const models = [
        { name: 'gemini-2.5-flash', tools: [{ googleSearch: {} }] },
        { name: 'gemini-2.5-flash', tools: undefined },
        { name: 'gemini-2.0-flash', tools: [{ googleSearch: {} }] },
        { name: 'gemini-2.0-flash', tools: undefined },
        { name: 'gemini-1.5-flash', tools: undefined }
    ];

    let responseText = null;
    let lastError = null;

    for (const modelConfig of models) {
        try {
            const modelOpts = { model: modelConfig.name };
            if (modelConfig.tools) modelOpts.tools = modelConfig.tools;
            const model = genAI.getGenerativeModel(modelOpts);

            const toolLabel = modelConfig.tools ? '+search' : 'no-tools';
            console.log(`[eFinder] Trying model: ${modelConfig.name} (${toolLabel})`);
            const result = await model.generateContent(prompt);
            responseText = result.response.text();
            console.log(`[eFinder] Success with model: ${modelConfig.name} (${toolLabel})`);
            break;
        } catch (err) {
            lastError = err;
            const errMsg = err?.message || err?.toString?.() || JSON.stringify(err);
            console.warn(`[eFinder] Model ${modelConfig.name} failed: ${errMsg.substring(0, 200)}`);

            // If rate limited, extract retry delay and try waiting once
            if (errMsg.includes('429') || errMsg.includes('quota')) {
                const retryMatch = errMsg.match(/retry in (\d+\.?\d*)/i);
                const waitSecs = retryMatch ? Math.min(parseFloat(retryMatch[1]), 30) : 0;

                if (waitSecs > 0) {
                    console.log(`[eFinder] Waiting ${waitSecs}s before trying next model...`);
                    await new Promise(r => setTimeout(r, waitSecs * 1000));
                }
            }
            continue;
        }
    }

    if (!responseText) {
        const errDetail = lastError?.message || lastError?.toString?.() || 'No error details captured';
        throw new Error(`All Gemini models exhausted. Last error: ${errDetail.substring(0, 300)}. Try again later or upgrade your plan.`);
    }

    // Parse the JSON from the response
    let eventData;
    try {
        // Try to extract JSON from the response (handle markdown code blocks)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in response');
        eventData = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
        throw new Error(`Failed to parse AI response: ${parseErr.message}\nRaw: ${responseText.substring(0, 500)}`);
    }

    // Validate required fields
    if (!eventData.title || !eventData.date || !eventData.locationName) {
        throw new Error('AI returned incomplete event data: missing title, date, or location');
    }

    // Geocode the location
    const coords = await geocode(eventData.locationName);
    if (!coords) {
        throw new Error(`Could not geocode location: ${eventData.locationName}`);
    }

    eventData.latitude = coords.lat;
    eventData.longitude = coords.lng;

    // Validate source URL — LLMs often hallucinate URLs
    if (eventData.sourceUrl) {
        try {
            const headRes = await axios.head(eventData.sourceUrl, {
                timeout: 5000,
                maxRedirects: 5,
                validateStatus: (s) => s < 400
            });
            console.log(`[eFinder] Source URL verified: ${eventData.sourceUrl} (${headRes.status})`);
        } catch (e) {
            console.warn(`[eFinder] Source URL broken (${e.message}), using Google search fallback`);
            // Replace with a Google search link that will actually find the event
            eventData.sourceUrl = `https://www.google.com/search?q=${encodeURIComponent(eventData.title + ' ' + eventData.locationName)}`;
        }
    }

    // Validate image URL — fetch a real related image if broken or missing
    eventData.imageUrl = await resolveEventImage(eventData.imageUrl, eventData.title, eventData.category);

    return eventData;
}

// Insert a discovered event into the DB as a "pending" discovery
async function insertDiscoveredEvent(eventData) {
    const pool = await poolPromise;

    // Check for duplicates
    const dup = await isDuplicate(pool, eventData.title, eventData.date, eventData.latitude, eventData.longitude);
    if (dup) {
        return { success: false, reason: 'Duplicate event already exists' };
    }

    // Insert the event
    const eventRes = await pool.query(`
        INSERT INTO "Events" (title, description, location_name, latitude, longitude, created_by, image_url, requires_approval, source_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8)
        RETURNING id
    `, [
        eventData.title,
        eventData.description || '',
        eventData.locationName,
        eventData.latitude,
        eventData.longitude,
        EFINDER_USER_ID,
        eventData.imageUrl || null,
        eventData.sourceUrl || null
    ]);

    const eventId = eventRes.rows[0].id;

    // Create time slot
    await pool.query(`
        INSERT INTO "EventTimeSlots" (event_id, start_time, duration_minutes, max_attendees)
        VALUES ($1, $2, 120, 50)
    `, [eventId, eventData.date]);

    // Invalidate cache
    const cacheService = require('./cacheService');
    cacheService.del('all_events_upcoming');

    return {
        success: true,
        eventId,
        event: { ...eventData, id: eventId }
    };
}

// Recommend events based on user history
async function recommendEvents(userHistory, upcomingEvents) {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
    if (!userHistory || userHistory.length === 0) return [];

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Based on a user's past event interest, rank the following upcoming events for them.
    
    User's Interest History:
    ${userHistory.map(h => `- ${h.title}: ${h.description}`).join('\n')}
    
    Upcoming Events to Rank:
    ${upcomingEvents.map(e => `[ID: ${e.id}] ${e.title}: ${e.description}`).join('\n')}
    
    Return ONLY a JSON array of the top 5 Event IDs that match their "vibe" most closely, in order of recommendation.
    Format: [id1, id2, id3, id4, id5]`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\[[\d,\s]*\]/);
        if (!jsonMatch) return [];
        const recommendedIds = JSON.parse(jsonMatch[0]);

        // Return upcoming events that match these IDs
        return recommendedIds.map(id => upcomingEvents.find(e => e.id == id)).filter(Boolean);
    } catch (err) {
        console.error('[eFinder] Recommendation failed:', err);
        return [];
    }
}

module.exports = {
    discoverEvents,
    insertDiscoveredEvent,
    recommendEvents,
    geocode
};
