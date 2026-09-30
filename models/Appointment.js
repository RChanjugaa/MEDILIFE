const mongoose = require('mongoose');

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const appointmentSchema = new mongoose.Schema(
    {
        patientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Patient',
            required: true,
            index: true
        },
        doctorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Doctor',
            required: true,
            index: true
        },
        appointmentDate: { type: String, required: true },
        appointmentTime: {
            type: String,
            required: true,
            validate: { validator: (v) => TIME_RE.test(v), message: 'appointmentTime must be HH:MM (24h)' }
        },
        appointmentAt: { type: Date, required: true, index: true },
        reason: { type: String, trim: true, maxlength: 1000 },
        snapshotPatientName: { type: String },
        snapshotPatientEmail: { type: String, lowercase: true, trim: true },
        snapshotPatientPhone: { type: String },
        status: {
            type: String,
            enum: ['pending', 'approved', 'completed', 'cancelled'],
            default: 'pending',
            index: true
        },
        emailStatus: { type: String, default: 'not_sent' },
        diagnosisNotes: { type: String, default: '' },
        prescription: { type: String, default: '' },
        deletedAt: { type: Date, default: null, index: true }
    },
    { timestamps: true }
);

appointmentSchema.virtual('patientName').get(function () { return this.snapshotPatientName; });
appointmentSchema.virtual('patientEmail').get(function () { return this.snapshotPatientEmail; });
appointmentSchema.virtual('patientPhone').get(function () { return this.snapshotPatientPhone; });
appointmentSchema.set('toJSON', { virtuals: true });
appointmentSchema.set('toObject', { virtuals: true });

appointmentSchema.index(
    { doctorId: 1, appointmentDate: 1, appointmentTime: 1 },
    { unique: true, partialFilterExpression: { deletedAt: null } }
);

appointmentSchema.pre('validate', function (next) {
    if (this.appointmentDate && this.appointmentTime && !this.appointmentAt) {
        const composed = new Date(`${this.appointmentDate}T${this.appointmentTime}:00`);
        if (!Number.isNaN(composed.getTime())) this.appointmentAt = composed;
    }
    next();
});

module.exports = mongoose.model('Appointment', appointmentSchema);
