const jwt = require('jsonwebtoken');

const optionalAuth = (req, res, next) => {
    const token = req.header('x-auth-token');

    if (!token) {
        return next();
    }

    try {
        const secret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test_secret' : null);
        if (!secret) return next(); 
        const decoded = jwt.verify(token, secret);
        req.user = decoded.user;
        next();
    } catch (err) {
        console.error('DEBUG: optionalAuth JWT Verification Failure', err.message);
        next();
    }
};

module.exports = optionalAuth;
