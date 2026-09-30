const Joi = require('joi');

const objectId = Joi.string().hex().length(24).messages({ 'string.hex': 'Invalid id', 'string.length': 'Invalid id' });
const email = Joi.string().email().lowercase().trim();
const phone = Joi.string().pattern(/^[+\d][\d\s\-()]{5,20}$/).allow('', null);
const isoDate = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).messages({ 'string.pattern.base': 'date must be YYYY-MM-DD' });
const time24 = Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).messages({ 'string.pattern.base': 'time must be HH:MM (24h)' });

const registerSchema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: email.required(),
    password: Joi.string().min(8).max(128).required(),
    role: Joi.string().valid('doctor', 'patient').optional()
});

const loginSchema = Joi.object({
    email: email.required(),
    password: Joi.string().required()
});

const googleLoginSchema = Joi.object({
    credential: Joi.string().required()
});

const publicAppointmentSchema = Joi.object({
    fullName: Joi.string().min(2).max(100).required(),
    email: email.required(),
    phone: phone,
    gender: Joi.string().valid('Male', 'Female', 'Other').optional(),
    doctorId: objectId.required(),
    appointmentDate: isoDate.required(),
    appointmentTime: time24.required(),
    reason: Joi.string().max(1000).allow('', null)
});

const patientBookingSchema = Joi.object({
    doctorId: objectId.required(),
    appointmentDate: isoDate.required(),
    appointmentTime: time24.required(),
    reason: Joi.string().max(1000).allow('', null)
});

const patientUpsertSchema = Joi.object({
    fullName: Joi.string().min(2).max(100).required(),
    email: email.required(),
    phone: phone,
    age: Joi.number().integer().min(0).max(150).optional(),
    gender: Joi.string().valid('Male', 'Female', 'Other').optional(),
    address: Joi.string().max(500).allow('', null),
    bloodGroup: Joi.string().valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', '').optional(),
    medicalHistory: Joi.string().max(5000).allow('', null)
});

const doctorUpsertSchema = Joi.object({
    fullName: Joi.string().min(2).max(100).required(),
    email: email.required(),
    phone: phone,
    specialization: Joi.string().max(120).allow('', null),
    department: Joi.string().max(120).allow('', null),
    availability: Joi.string().max(200).allow('', null),
    availabilitySlots: Joi.array().items(
        Joi.object({
            dayOfWeek: Joi.number().integer().min(0).max(6).required(),
            startTime: time24.required(),
            endTime: time24.required(),
            slotDurationMin: Joi.number().integer().min(5).max(240).default(30)
        })
    ).optional(),
    status: Joi.string().valid('active', 'inactive').optional()
});

const staffUpsertSchema = Joi.object({
    fullName: Joi.string().min(2).max(100).required(),
    email: email.required(),
    phone: phone,
    position: Joi.string().max(120).allow('', null),
    department: Joi.string().max(120).allow('', null),
    shift: Joi.string().max(120).allow('', null),
    status: Joi.string().valid('active', 'inactive').optional()
});

const appointmentStatusSchema = Joi.object({
    status: Joi.string().valid('pending', 'approved', 'completed', 'cancelled').required()
});

const userRoleSchema = Joi.object({
    role: Joi.string().valid('admin', 'doctor', 'staff', 'patient').required()
});

const medicalNotesSchema = Joi.object({
    diagnosisNotes: Joi.string().max(10000).allow('', null),
    prescription: Joi.string().max(10000).allow('', null)
});

const paginationSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid('pending', 'approved', 'completed', 'cancelled').optional(),
    q: Joi.string().max(120).optional()
}).unknown(true);

module.exports = {
    registerSchema,
    loginSchema,
    googleLoginSchema,
    publicAppointmentSchema,
    patientBookingSchema,
    patientUpsertSchema,
    doctorUpsertSchema,
    staffUpsertSchema,
    appointmentStatusSchema,
    userRoleSchema,
    medicalNotesSchema,
    paginationSchema
};
