const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: String,
    position: String, // e.g., Receptionist, Nurse
    department: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Staff', staffSchema);