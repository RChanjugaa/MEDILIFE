const mongoose = require('mongoose');

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const slotSchema = new mongoose.Schema(
    {
        dayOfWeek: { type: Number, min: 0, max: 6, required: true },
        startTime: {
            type: String,
            required: true,
            validate: { validator: (v) => TIME_RE.test(v), message: 'startTime must be HH:MM (24h)' }
        },
        endTime: {
            type: String,
            required: true,
            validate: { validator: (v) => TIME_RE.test(v), message: 'endTime must be HH:MM (24h)' }
        },
        slotDurationMin: { type: Number, default: 30, min: 5, max: 240 }
    },
    { _id: false }
);

const doctorSchema = new mongoose.Schema(
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
        specialization: { type: String, trim: true, index: true },
        department: { type: String, trim: true, index: true },
        availability: { type: String, default: '9:00 AM - 5:00 PM' },
        availabilitySlots: { type: [slotSchema], default: [] },
        status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
        deletedAt: { type: Date, default: null, index: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Doctor', doctorSchema);
