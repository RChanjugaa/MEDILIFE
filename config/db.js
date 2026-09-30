const mongoose = require('mongoose');

const REQUIRED_VARS = ['MONGO_URI', 'JWT_SECRET'];

const assertEnv = () => {
    const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
    if (missing.length) {
        console.error(`[boot] Missing required env vars: ${missing.join(', ')}`);
        console.error('[boot] On Render, set these in the service Environment tab.');
        process.exit(1);
    }
};

const connectDB = async () => {
    assertEnv();

    mongoose.set('strictQuery', true);

    mongoose.connection.on('connected', () => {
        console.log(`[db] connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
    });
    mongoose.connection.on('error', (err) => {
        console.error(`[db] connection error: ${err.message}`);
    });
    mongoose.connection.on('disconnected', () => {
        console.warn('[db] disconnected');
    });

    const maxAttempts = Number(process.env.MONGO_MAX_RETRIES || 5);
    const baseDelayMs = Number(process.env.MONGO_RETRY_BASE_MS || 2000);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            await mongoose.connect(process.env.MONGO_URI, {
                serverSelectionTimeoutMS: 15000,
                socketTimeoutMS: 45000,
                maxPoolSize: 10
            });
            return;
        } catch (err) {
            const delay = baseDelayMs * attempt;
            console.error(`[db] attempt ${attempt}/${maxAttempts} failed: ${err.message}`);
            if (err.message && err.message.toLowerCase().includes('ip')) {
                console.error('[db] hint: MongoDB Atlas may be blocking this IP. On Render, allowlist 0.0.0.0/0 in Atlas Network Access.');
            }
            if (attempt === maxAttempts) {
                console.error('[db] giving up — exiting');
                process.exit(1);
            }
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
};

module.exports = connectDB;
