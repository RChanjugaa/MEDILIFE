const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: String,
    position: String, // e.g., Receptionist, Nurse
    department: String,
    shift: String,
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Staff', staffSchema);
