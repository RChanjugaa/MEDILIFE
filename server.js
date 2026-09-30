const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');

dotenv.config();

const connectDB = require('./config/db.js');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const start = async () => {
    await connectDB();

    const app = express();

    app.set('trust proxy', 1);

    app.use(
        helmet({
            contentSecurityPolicy: false,
            crossOriginEmbedderPolicy: false
        })
    );
    app.use(cors());
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: false, limit: '1mb' }));
    app.use(mongoSanitize());

    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 30,
        standardHeaders: true,
        legacyHeaders: false,
        message: { message: 'Too many auth requests. Try again later.' }
    });
    const publicBookingLimiter = rateLimit({
        windowMs: 60 * 60 * 1000,
        max: 20,
        standardHeaders: true,
        legacyHeaders: false,
        message: { message: 'Too many booking requests. Try again later.' }
    });

    app.use(express.static(path.join(__dirname, 'public')));

    app.get('/healthz', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

    app.use('/api/auth', authLimiter, require('./routes/authRoutes'));
    app.use('/api/public/appointments', publicBookingLimiter);
    app.use('/api', require('./routes/apiRoutes'));

    app.use(notFound);
    app.use(errorHandler);

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`[server] running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
};

start().catch((err) => {
    console.error('[boot] fatal:', err);
    process.exit(1);
});
