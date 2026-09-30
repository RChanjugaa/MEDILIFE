const mongoose = require('mongoose');

const medicalRecordSchema = new mongoose.Schema(
    {
        patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
        doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
        appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', index: true },
        diagnosis: { type: String, default: '' },
        prescription: { type: String, default: '' },
        notes: { type: String, default: '' },
        recordedAt: { type: Date, default: Date.now, index: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema);
