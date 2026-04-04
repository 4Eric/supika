const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { poolPromise } = require('../config/db');
const { sendConfirmationEmail } = require('../utils/mailer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Image Storage Configuration (Conditional Local vs Cloudinary)
let storage;
if (process.env.USE_LOCAL_STORAGE === 'true') {
    console.log('Using LOCAL storage for uploads');
    storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, path.join(__dirname, '../uploads/'));
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        }
    });
} else {
    // Cloudinary storage for production
    cloudinary.config();
    storage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: {
            folder: 'supika-events',
            allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov'],
            transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        },
    });
}

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

const auth = require('../utils/auth');
const optionalAuth = require('../utils/optionalAuth');
const { eventsWriteLimiter } = require('../middlewares/rateLimiter');
const { eventValidation } = require('../middlewares/validator');
const { isEventHost } = require('../middlewares/accessControl');

const eventController = require('../controllers/eventController');

// Get all events
router.get('/', eventController.getAllEvents);

// Get registered events for current user
router.get('/registered/me', auth, eventController.getRegisteredEvents);

// Get hosted events for current user
router.get('/hosted/me', auth, eventController.getHostedEvents);

// Get single event
router.get('/:id', eventController.getEventById);

const commentController = require('../controllers/commentController');

// --- Comments / Q&A ---
router.get('/:id/comments', optionalAuth, commentController.getComments);
router.post('/:id/comments', auth, commentController.addComment);
router.post('/:id/comments/:commentId/like', auth, commentController.toggleLike);

// Create event
router.post('/', [auth, eventsWriteLimiter, upload.array('media', 10), eventValidation], eventController.createEvent);

// Update an existing event (Creator Only)
router.put('/:id', [auth, isEventHost, eventsWriteLimiter, upload.array('media', 10), eventValidation], eventController.updateEvent);

// Register for event
router.post('/:id/register', auth, eventController.registerForEvent);

// Deregister from an event
router.delete('/:id/register', auth, eventController.deregisterFromEvent);

// Get attendees for an event (creator only)
router.get('/:id/attendees', [auth, isEventHost], eventController.getAttendees);

// Update attendee status (creator only)
router.put('/:id/attendees/:userId', [auth, isEventHost], eventController.updateAttendeeStatus);

// Delete event (creator only)
router.delete('/:id', [auth, isEventHost], eventController.deleteEvent);

// Memory Board
router.get('/:id/memories', eventController.getEventMemories);
router.post('/:id/memories', [auth, upload.array('media', 1)], eventController.addEventMemory);

module.exports = router;
