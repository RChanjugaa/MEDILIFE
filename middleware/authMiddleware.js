const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
    const token = header.slice(7).trim();
    if (!token) return res.status(401).json({ message: 'Not authorized, no token' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        if (!user || user.deletedAt) {
            return res.status(401).json({ message: 'Not authorized, user not found' });
        }
        req.user = user;
        return next();
    } catch (err) {
        return res.status(401).json({ message: 'Not authorized, token failed' });
    }
};

const authorize = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({
            message: `User role ${req.user ? req.user.role : 'guest'} is not authorized to access this route`
        });
    }
    next();
};

module.exports = { protect, authorize };
