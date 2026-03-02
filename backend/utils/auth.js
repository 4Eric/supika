const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
    const token = req.header('x-auth-token');

    // Check if no token
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Verify token
    try {
        const secret = process.env.JWT_SECRET || 'secret';
        const decoded = jwt.verify(token, secret);
        req.user = decoded.user;
        next();
    } catch (err) {
        console.error('DEBUG: JWT Verification Failure');
        console.error('Error:', err.message);
        console.error('Token:', token ? (token.substring(0, 10) + '...') : 'None');
        res.status(401).json({ message: 'Token is not valid' });
    }
};

module.exports = auth;
