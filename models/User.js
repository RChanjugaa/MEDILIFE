const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },
        password: {
            type: String,
            required: function () {
                return this.authProvider !== 'google';
            }
        },
        googleId: { type: String, index: true, sparse: true },
        authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
        role: {
            type: String,
            enum: ['admin', 'doctor', 'staff', 'patient'],
            default: 'patient',
            index: true
        },
        deletedAt: { type: Date, default: null, index: true }
    },
    { timestamps: true }
);

userSchema.pre('save', async function (next) {
    try {
        if (!this.isModified('password') || !this.password) return next();
        const salt = await bcrypt.genSalt(SALT_ROUNDS);
        this.password = await bcrypt.hash(this.password, salt);
        return next();
    } catch (err) {
        return next(err);
    }
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    if (!this.password) return false;
    return bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.toSafeJSON = function () {
    return {
        _id: this._id,
        name: this.name,
        email: this.email,
        role: this.role,
        authProvider: this.authProvider,
        createdAt: this.createdAt
    };
};

module.exports = mongoose.model('User', userSchema);
