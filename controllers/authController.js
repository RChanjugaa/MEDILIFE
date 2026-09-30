const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');
const { writeAudit } = require('../middleware/audit');

const TOKEN_TTL = process.env.JWT_EXPIRES_IN || '30d';

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });

const respondWithToken = (res, user, status = 200) => {
    res.status(status).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id)
    });
};

exports.registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: 'User already exists' });

    const user = await User.create({
        name,
        email,
        password,
        role: role || 'patient'
    });

    await writeAudit({ req, action: 'user.register', entity: 'User', entityId: user._id });
    respondWithToken(res, user, 201);
});

exports.loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email, deletedAt: null });
    if (!user || !(await user.matchPassword(password))) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }
    respondWithToken(res, user);
});

exports.getUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user.toSafeJSON());
});

exports.getAuthConfig = (req, res) => {
    res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || '' });
};

exports.googleLogin = asyncHandler(async (req, res) => {
    const { credential } = req.body;

    if (!process.env.GOOGLE_CLIENT_ID) {
        return res.status(400).json({ message: 'Google login is not configured yet.' });
    }

    const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
    const googleResponse = await fetch(verifyUrl);
    if (!googleResponse.ok) {
        return res.status(401).json({ message: 'Google login could not be verified.' });
    }

    const profile = await googleResponse.json();
    if (profile.aud !== process.env.GOOGLE_CLIENT_ID) {
        return res.status(401).json({ message: 'Google login was issued for a different app.' });
    }
    if (profile.email_verified !== 'true' && profile.email_verified !== true) {
        return res.status(401).json({ message: 'Google account email is not verified.' });
    }

    const email = (profile.email || '').toLowerCase();
    let user = await User.findOne({ email });
    if (!user) {
        user = await User.create({
            name: profile.name || email,
            email,
            googleId: profile.sub,
            authProvider: 'google',
            role: 'patient'
        });
        await writeAudit({ req, action: 'user.register.google', entity: 'User', entityId: user._id });
    } else if (!user.googleId) {
        user.googleId = profile.sub;
        user.authProvider = user.authProvider || 'google';
        await user.save();
    }

    respondWithToken(res, user);
});
