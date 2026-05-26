const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// @desc    Register new user
// @route   POST /api/auth/register
exports.registerUser = async (req, res) => {
    const { name, email, password, role } = req.body;
    try {
        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ message: 'User already exists' });

        const allowedPublicRoles = ['doctor', 'patient'];
        const user = await User.create({
            name,
            email,
            password,
            role: allowedPublicRoles.includes(role) ? role : 'patient'
        });
        if (user) {
            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id),
            });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
exports.loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (user && (await user.matchPassword(password))) {
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id),
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
exports.getUserProfile = async (req, res) => {
    const user = await User.findById(req.user._id);
    if (user) {
        res.json({ _id: user._id, name: user.name, email: user.email, role: user.role });
    } else {
        res.status(404).json({ message: 'User not found' });
    }
};

exports.getAuthConfig = async (req, res) => {
    res.json({
        googleClientId: process.env.GOOGLE_CLIENT_ID || ''
    });
};

exports.googleLogin = async (req, res) => {
    const { credential } = req.body;

    if (!process.env.GOOGLE_CLIENT_ID) {
        return res.status(400).json({ message: 'Google login is not configured yet.' });
    }

    if (!credential) {
        return res.status(400).json({ message: 'Missing Google credential.' });
    }

    try {
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

        let user = await User.findOne({ email: profile.email });
        if (!user) {
            user = await User.create({
                name: profile.name || profile.email,
                email: profile.email,
                googleId: profile.sub,
                authProvider: 'google',
                role: 'patient'
            });
        } else if (!user.googleId) {
            user.googleId = profile.sub;
            user.authProvider = user.authProvider || 'google';
            await user.save();
        }

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user._id),
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
