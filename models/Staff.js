const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            index: true,
            unique: true,
            sparse: true
        },
        fullName: { type: String, required: true, trim: true },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },
        phone: { type: String, trim: true },
        position: { type: String, trim: true },
        department: { type: String, trim: true, index: true },
        shift: { type: String, trim: true },
        status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
        deletedAt: { type: Date, default: null, index: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Staff', staffSchema);
