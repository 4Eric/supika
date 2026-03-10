const { validationResult, body, param, query } = require('express-validator');
const { error } = require('../utils/response');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
        return next();
    }
    const extractedErrors = [];
    errors.array().map(err => extractedErrors.push({ [err.path]: err.msg }));

    return error(res, 'Validation Failed', 400, 'VALIDATION_ERROR'); // Can attach errors array via custom res format if needed, for now standardizing message. Let's customize response later if needed, but the prompt says 400 with detailed json.
    // Actually wait, let's return the extracted errors.
};

const sendValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array(),
            code: 'VALIDATION_ERROR'
        });
    }
    next();
};

const registerValidation = [
    body('username').trim().notEmpty().withMessage('Username is required').isLength({ min: 3, max: 30 }).withMessage('Must be 3-30 chars').isAlphanumeric().withMessage('Must be alphanumeric'),
    body('email').trim().isEmail().withMessage('Invalid email format').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 chars'),
    sendValidationErrors
];

const loginValidation = [
    body('email').trim().isEmail().withMessage('Invalid email').normalizeEmail(),
    body('password').notEmpty().withMessage('Password required'),
    sendValidationErrors
];

const eventValidation = [
    body('title').trim().isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 chars').escape(),
    body('description').optional().trim().isLength({ max: 5000 }).withMessage('Max 5000 chars').escape(),
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
    body('locationName').trim().notEmpty().withMessage('Location name required').escape(),
    sendValidationErrors // Note that date validation needs to be handled on timeSlots separately if it's an array
];

const messageValidation = [
    body('content').trim().notEmpty().withMessage('Empty message').isLength({ max: 2000 }).withMessage('Max length 2000'),
    sendValidationErrors
];

module.exports = {
    registerValidation,
    loginValidation,
    eventValidation,
    messageValidation
};
