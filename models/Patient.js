const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: String,
    age: Number,
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    address: String,
    bloodGroup: String,
    medicalHistory: { type: String, default: "None" },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Patient', patientSchema);