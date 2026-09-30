const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema(
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
        age: { type: Number, min: 0, max: 150 },
        gender: { type: String, enum: ['Male', 'Female', 'Other'] },
        address: { type: String, trim: true },
        bloodGroup: {
            type: String,
            enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', '']
        },
        medicalHistory: { type: String, default: 'None' },
        deletedAt: { type: Date, default: null, index: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Patient', patientSchema);
