const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    appointmentDate: { type: String, required: true },
    appointmentTime: { type: String, required: true },
    reason: String,
    patientName: String,
    patientEmail: String,
    patientPhone: String,
    status: { 
        type: String, 
        enum: ['pending', 'approved', 'completed', 'cancelled'], 
        default: 'pending' 
    },
    emailStatus: { type: String, default: 'not_sent' },
    diagnosisNotes: { type: String, default: "" },
    prescription: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Appointment', appointmentSchema);
