const express = require('express');
const router = express.Router();
const {
    registerUser, loginUser, getUserProfile, googleLogin, getAuthConfig
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const {
    registerSchema, loginSchema, googleLoginSchema
} = require('../validators');

router.post('/register', validate(registerSchema), registerUser);
router.post('/login', validate(loginSchema), loginUser);
router.post('/google', validate(googleLoginSchema), googleLogin);
router.get('/config', getAuthConfig);
router.get('/profile', protect, getUserProfile);

module.exports = router;
