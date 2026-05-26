const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: String,
    specialization: String,
    department: String,
    availability: { type: String, default: "9:00 AM - 5:00 PM" },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Doctor', doctorSchema);