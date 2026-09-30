const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Staff = require('../models/Staff');
const Appointment = require('../models/Appointment');
const MedicalRecord = require('../models/MedicalRecord');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');
const { writeAudit } = require('../middleware/audit');
const { sendAppointmentEmail } = require('../utils/emailService');

const PATIENT_FIELDS = ['fullName', 'email', 'phone', 'age', 'gender', 'address', 'bloodGroup', 'medicalHistory'];
const DOCTOR_FIELDS = ['fullName', 'email', 'phone', 'specialization', 'department', 'availability', 'availabilitySlots', 'status'];
const STAFF_FIELDS = ['fullName', 'email', 'phone', 'position', 'department', 'shift', 'status'];

const pick = (obj, fields) => fields.reduce((acc, f) => {
    if (obj[f] !== undefined) acc[f] = obj[f];
    return acc;
}, {});

const normalizeEmail = (email) => (email || '').trim().toLowerCase();

const appointmentPopulate = [
    { path: 'patientId', select: 'fullName email phone age gender bloodGroup address medicalHistory userId' },
    { path: 'doctorId', select: 'fullName email phone specialization department availability status userId' }
];

const visibleFilter = { deletedAt: null };

const populateAppointmentQuery = (query) =>
    query.populate(appointmentPopulate).sort({ appointmentAt: -1, createdAt: -1 });

const parsePagination = (req) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    return { page, limit, skip: (page - 1) * limit };
};

const paginated = async (model, baseFilter, req, opts = {}) => {
    const filter = { ...visibleFilter, ...baseFilter };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.q) {
        filter.$or = [
            { fullName: { $regex: req.query.q, $options: 'i' } },
            { email: { $regex: req.query.q, $options: 'i' } }
        ];
    }

    const wantsPagination = req.query.page !== undefined || req.query.limit !== undefined;

    if (!wantsPagination) {
        return opts.populate
            ? populateAppointmentQuery(model.find(filter))
            : model.find(filter).sort(opts.sort || { createdAt: -1 });
    }

    const { page, limit, skip } = parsePagination(req);
    const [items, total] = await Promise.all([
        opts.populate
            ? populateAppointmentQuery(model.find(filter).skip(skip).limit(limit))
            : model.find(filter).sort(opts.sort || { createdAt: -1 }).skip(skip).limit(limit),
        model.countDocuments(filter)
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
};

const linkOrCreatePatient = async (user) => {
    let patient = await Patient.findOne({ userId: user._id, deletedAt: null });
    if (patient) return patient;

    patient = await Patient.findOne({ email: normalizeEmail(user.email), deletedAt: null });
    if (patient) {
        if (!patient.userId) {
            patient.userId = user._id;
            await patient.save();
        }
        return patient;
    }
    return Patient.create({
        userId: user._id,
        fullName: user.name,
        email: normalizeEmail(user.email),
        gender: 'Other'
    });
};

const findDoctorForUser = async (user) => {
    let doctor = await Doctor.findOne({ userId: user._id, deletedAt: null });
    if (doctor) return doctor;
    doctor = await Doctor.findOne({ email: normalizeEmail(user.email), deletedAt: null });
    if (doctor && !doctor.userId) {
        doctor.userId = user._id;
        await doctor.save();
    }
    return doctor;
};

const sendStatusEmailIfNeeded = async (appointment, status) => {
    if (!['approved', 'cancelled'].includes(status)) return;
    const patientEmail = appointment.snapshotPatientEmail || appointment.patientId?.email;
    if (!patientEmail) return;
    const result = await sendAppointmentEmail({
        to: patientEmail,
        name: appointment.snapshotPatientName || appointment.patientId?.fullName || 'Patient',
        doctorName: appointment.doctorId?.fullName || 'your doctor',
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        status
    });
    appointment.emailStatus = result.status;
};

const updateAppointmentStatus = async (req, id, status, allowed) => {
    if (allowed && !allowed.includes(status)) {
        const err = new Error(`This role can only set: ${allowed.join(', ')}`);
        err.status = 403;
        throw err;
    }
    const appointment = await Appointment.findOne({ _id: id, deletedAt: null })
        .populate('patientId', 'fullName email')
        .populate('doctorId', 'fullName');
    if (!appointment) {
        const err = new Error('Appointment not found.');
        err.status = 404;
        throw err;
    }
    const before = { status: appointment.status };
    appointment.status = status;
    await sendStatusEmailIfNeeded(appointment, status);
    await appointment.save();
    await writeAudit({
        req,
        action: 'appointment.status',
        entity: 'Appointment',
        entityId: appointment._id,
        before,
        after: { status }
    });
    return appointment;
};

// ---------- Public ----------
exports.getDoctors = asyncHandler(async (req, res) => {
    const doctors = await Doctor.find({ status: 'active', deletedAt: null }).sort({ fullName: 1 });
    res.json(doctors);
});

exports.getDoctorSlots = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'date (YYYY-MM-DD) is required' });

    const doctor = await Doctor.findOne({ _id: id, deletedAt: null });
    if (!doctor) return res.status(404).json({ message: 'Doctor not found.' });

    const target = new Date(`${date}T00:00:00`);
    if (Number.isNaN(target.getTime())) return res.status(400).json({ message: 'Invalid date.' });

    const dayOfWeek = target.getDay();
    const slots = (doctor.availabilitySlots || []).filter((s) => s.dayOfWeek === dayOfWeek);

    const taken = await Appointment.find({
        doctorId: doctor._id,
        appointmentDate: date,
        deletedAt: null,
        status: { $in: ['pending', 'approved'] }
    }).select('appointmentTime');
    const takenSet = new Set(taken.map((t) => t.appointmentTime));

    const result = [];
    for (const slot of slots) {
        const [sh, sm] = slot.startTime.split(':').map(Number);
        const [eh, em] = slot.endTime.split(':').map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        for (let m = startMin; m + slot.slotDurationMin <= endMin; m += slot.slotDurationMin) {
            const hh = String(Math.floor(m / 60)).padStart(2, '0');
            const mm = String(m % 60).padStart(2, '0');
            const time = `${hh}:${mm}`;
            result.push({ time, available: !takenSet.has(time) });
        }
    }
    res.json({ doctorId: doctor._id, date, slots: result });
});

exports.bookPublicAppointment = asyncHandler(async (req, res) => {
    const { fullName, email, phone, doctorId, appointmentDate, appointmentTime, reason, gender } = req.body;

    const doctor = await Doctor.findOne({ _id: doctorId, deletedAt: null });
    if (!doctor) return res.status(404).json({ message: 'Doctor not found.' });

    const normalEmail = normalizeEmail(email);
    let patient = await Patient.findOne({ email: normalEmail, deletedAt: null });
    if (!patient) {
        patient = await Patient.create({
            fullName,
            email: normalEmail,
            phone,
            gender: gender || 'Other'
        });
    } else {
        patient.fullName = fullName;
        if (phone) patient.phone = phone;
        await patient.save();
    }

    const appointment = await Appointment.create({
        patientId: patient._id,
        doctorId,
        appointmentDate,
        appointmentTime,
        reason,
        snapshotPatientName: fullName,
        snapshotPatientEmail: normalEmail,
        snapshotPatientPhone: phone,
        status: 'pending'
    });

    const emailResult = await sendAppointmentEmail({
        to: normalEmail,
        name: fullName,
        doctorName: doctor.fullName,
        appointmentDate,
        appointmentTime,
        status: 'pending'
    });
    appointment.emailStatus = emailResult.status;
    await appointment.save();

    await writeAudit({ req, action: 'appointment.create.public', entity: 'Appointment', entityId: appointment._id });

    res.status(201).json({
        message: 'Appointment request received.',
        appointment
    });
});

// ---------- Admin ----------
exports.getAdminStats = asyncHandler(async (req, res) => {
    const [
        patientCount, doctorCount, staffCount, appointmentCount,
        pendingCount, approvedCount, completedCount, cancelledCount,
        recentAppointments, recentPatients
    ] = await Promise.all([
        Patient.countDocuments(visibleFilter),
        Doctor.countDocuments(visibleFilter),
        Staff.countDocuments(visibleFilter),
        Appointment.countDocuments(visibleFilter),
        Appointment.countDocuments({ ...visibleFilter, status: 'pending' }),
        Appointment.countDocuments({ ...visibleFilter, status: 'approved' }),
        Appointment.countDocuments({ ...visibleFilter, status: 'completed' }),
        Appointment.countDocuments({ ...visibleFilter, status: 'cancelled' }),
        populateAppointmentQuery(Appointment.find(visibleFilter).limit(6)),
        Patient.find(visibleFilter).sort({ createdAt: -1 }).limit(6)
    ]);
    res.json({
        patientCount, doctorCount, staffCount, appointmentCount,
        pendingCount, approvedCount, completedCount, cancelledCount,
        recentAppointments, recentPatients
    });
});

exports.adminGetPatients = asyncHandler(async (req, res) => {
    res.json(await paginated(Patient, {}, req));
});
exports.adminCreatePatient = asyncHandler(async (req, res) => {
    const patient = await Patient.create({ ...pick(req.body, PATIENT_FIELDS), email: normalizeEmail(req.body.email) });
    await writeAudit({ req, action: 'patient.create', entity: 'Patient', entityId: patient._id });
    res.status(201).json(patient);
});
exports.adminUpdatePatient = asyncHandler(async (req, res) => {
    const data = pick(req.body, PATIENT_FIELDS);
    if (data.email) data.email = normalizeEmail(data.email);
    const patient = await Patient.findOneAndUpdate(
        { _id: req.params.id, deletedAt: null },
        data,
        { new: true, runValidators: true }
    );
    if (!patient) return res.status(404).json({ message: 'Patient not found.' });
    await writeAudit({ req, action: 'patient.update', entity: 'Patient', entityId: patient._id, after: data });
    res.json(patient);
});
exports.adminDeletePatient = asyncHandler(async (req, res) => {
    const patient = await Patient.findOneAndUpdate(
        { _id: req.params.id, deletedAt: null },
        { deletedAt: new Date() },
        { new: true }
    );
    if (!patient) return res.status(404).json({ message: 'Patient not found.' });
    await Appointment.updateMany({ patientId: req.params.id, deletedAt: null }, { deletedAt: new Date() });
    await writeAudit({ req, action: 'patient.delete', entity: 'Patient', entityId: patient._id });
    res.json({ message: 'Patient deleted.' });
});

exports.adminGetDoctors = asyncHandler(async (req, res) => {
    res.json(await paginated(Doctor, {}, req, { sort: { fullName: 1 } }));
});
exports.adminCreateDoctor = asyncHandler(async (req, res) => {
    const doctor = await Doctor.create({ ...pick(req.body, DOCTOR_FIELDS), email: normalizeEmail(req.body.email) });
    await writeAudit({ req, action: 'doctor.create', entity: 'Doctor', entityId: doctor._id });
    res.status(201).json(doctor);
});
exports.adminUpdateDoctor = asyncHandler(async (req, res) => {
    const data = pick(req.body, DOCTOR_FIELDS);
    if (data.email) data.email = normalizeEmail(data.email);
    const doctor = await Doctor.findOneAndUpdate(
        { _id: req.params.id, deletedAt: null },
        data,
        { new: true, runValidators: true }
    );
    if (!doctor) return res.status(404).json({ message: 'Doctor not found.' });
    await writeAudit({ req, action: 'doctor.update', entity: 'Doctor', entityId: doctor._id, after: data });
    res.json(doctor);
});
exports.adminDeleteDoctor = asyncHandler(async (req, res) => {
    const hasAppointments = await Appointment.exists({ doctorId: req.params.id, deletedAt: null });
    if (hasAppointments) {
        return res.status(409).json({ message: 'Doctor has appointments. Set status to inactive instead.' });
    }
    const doctor = await Doctor.findOneAndUpdate(
        { _id: req.params.id, deletedAt: null },
        { deletedAt: new Date() },
        { new: true }
    );
    if (!doctor) return res.status(404).json({ message: 'Doctor not found.' });
    await writeAudit({ req, action: 'doctor.delete', entity: 'Doctor', entityId: doctor._id });
    res.json({ message: 'Doctor deleted.' });
});

exports.adminGetStaff = asyncHandler(async (req, res) => {
    res.json(await paginated(Staff, {}, req, { sort: { fullName: 1 } }));
});
exports.adminCreateStaff = asyncHandler(async (req, res) => {
    const staff = await Staff.create({ ...pick(req.body, STAFF_FIELDS), email: normalizeEmail(req.body.email) });
    await writeAudit({ req, action: 'staff.create', entity: 'Staff', entityId: staff._id });
    res.status(201).json(staff);
});
exports.adminUpdateStaff = asyncHandler(async (req, res) => {
    const data = pick(req.body, STAFF_FIELDS);
    if (data.email) data.email = normalizeEmail(data.email);
    const staff = await Staff.findOneAndUpdate(
        { _id: req.params.id, deletedAt: null },
        data,
        { new: true, runValidators: true }
    );
    if (!staff) return res.status(404).json({ message: 'Staff member not found.' });
    await writeAudit({ req, action: 'staff.update', entity: 'Staff', entityId: staff._id, after: data });
    res.json(staff);
});
exports.adminDeleteStaff = asyncHandler(async (req, res) => {
    const staff = await Staff.findOneAndUpdate(
        { _id: req.params.id, deletedAt: null },
        { deletedAt: new Date() },
        { new: true }
    );
    if (!staff) return res.status(404).json({ message: 'Staff member not found.' });
    await writeAudit({ req, action: 'staff.delete', entity: 'Staff', entityId: staff._id });
    res.json({ message: 'Staff member deleted.' });
});

exports.adminGetAppointments = asyncHandler(async (req, res) => {
    res.json(await paginated(Appointment, {}, req, { populate: true }));
});
exports.adminUpdateAppointmentStatus = asyncHandler(async (req, res) => {
    const appt = await updateAppointmentStatus(req, req.params.id, req.body.status);
    res.json(appt);
});
exports.adminDeleteAppointment = asyncHandler(async (req, res) => {
    const appt = await Appointment.findOneAndUpdate(
        { _id: req.params.id, deletedAt: null },
        { deletedAt: new Date() },
        { new: true }
    );
    if (!appt) return res.status(404).json({ message: 'Appointment not found.' });
    await writeAudit({ req, action: 'appointment.delete', entity: 'Appointment', entityId: appt._id });
    res.json({ message: 'Appointment deleted.' });
});

exports.adminGetUsers = asyncHandler(async (req, res) => {
    const result = await paginated(User, {}, req);
    if (Array.isArray(result)) {
        return res.json(result.map((u) => (u.toSafeJSON ? u.toSafeJSON() : u)));
    }
    result.items = result.items.map((u) => (u.toSafeJSON ? u.toSafeJSON() : u));
    res.json(result);
});

exports.adminUpdateUserRole = asyncHandler(async (req, res) => {
    const { role } = req.body;
    const user = await User.findOne({ _id: req.params.id, deletedAt: null });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (user.role === 'admin' && role !== 'admin') {
        const adminCount = await User.countDocuments({ role: 'admin', deletedAt: null });
        if (adminCount <= 1) {
            return res.status(409).json({ message: 'You cannot remove the last admin account.' });
        }
    }
    const before = { role: user.role };
    user.role = role;
    await user.save();
    await writeAudit({ req, action: 'user.role', entity: 'User', entityId: user._id, before, after: { role } });
    res.json({ _id: user._id, name: user.name, email: user.email, role: user.role });
});

// ---------- Doctor ----------
exports.doctorGetAppointments = asyncHandler(async (req, res) => {
    const doctor = await findDoctorForUser(req.user);
    if (!doctor) return res.json([]);
    res.json(await paginated(Appointment, { doctorId: doctor._id }, req, { populate: true }));
});

exports.doctorGetPatients = asyncHandler(async (req, res) => {
    const doctor = await findDoctorForUser(req.user);
    if (!doctor) return res.json([]);
    const ids = await Appointment.find({ doctorId: doctor._id, deletedAt: null }).distinct('patientId');
    const patients = await Patient.find({ _id: { $in: ids }, deletedAt: null }).sort({ fullName: 1 });
    res.json(patients);
});

exports.doctorUpdateMedicalNotes = asyncHandler(async (req, res) => {
    const doctor = await findDoctorForUser(req.user);
    if (!doctor) return res.status(404).json({ message: 'Doctor profile not found.' });

    const appointment = await Appointment.findOne({ _id: req.params.id, doctorId: doctor._id, deletedAt: null });
    if (!appointment) return res.status(404).json({ message: 'Appointment not found for this doctor.' });

    appointment.diagnosisNotes = req.body.diagnosisNotes || '';
    appointment.prescription = req.body.prescription || '';
    await appointment.save();

    await MedicalRecord.create({
        patientId: appointment.patientId,
        doctorId: doctor._id,
        appointmentId: appointment._id,
        diagnosis: appointment.diagnosisNotes,
        prescription: appointment.prescription
    });
    await writeAudit({ req, action: 'appointment.notes', entity: 'Appointment', entityId: appointment._id });
    res.json(appointment);
});

exports.doctorCompleteAppointment = asyncHandler(async (req, res) => {
    const doctor = await findDoctorForUser(req.user);
    if (!doctor) return res.status(404).json({ message: 'Doctor profile not found.' });

    const appointment = await Appointment.findOne({ _id: req.params.id, doctorId: doctor._id, deletedAt: null });
    if (!appointment) return res.status(404).json({ message: 'Appointment not found for this doctor.' });

    appointment.status = 'completed';
    await appointment.save();
    await writeAudit({ req, action: 'appointment.complete', entity: 'Appointment', entityId: appointment._id });
    res.json(appointment);
});

// ---------- Patient ----------
exports.patientGetProfile = asyncHandler(async (req, res) => {
    const patient = await linkOrCreatePatient(req.user);
    res.json(patient);
});

exports.patientGetAppointments = asyncHandler(async (req, res) => {
    const patient = await linkOrCreatePatient(req.user);
    res.json(await paginated(Appointment, { patientId: patient._id }, req, { populate: true }));
});

exports.patientBookAppointment = asyncHandler(async (req, res) => {
    const { doctorId, appointmentDate, appointmentTime, reason } = req.body;

    const doctor = await Doctor.findOne({ _id: doctorId, deletedAt: null });
    if (!doctor) return res.status(404).json({ message: 'Doctor not found.' });

    const patient = await linkOrCreatePatient(req.user);

    const appointment = await Appointment.create({
        patientId: patient._id,
        doctorId,
        appointmentDate,
        appointmentTime,
        reason,
        snapshotPatientName: patient.fullName,
        snapshotPatientEmail: patient.email,
        snapshotPatientPhone: patient.phone,
        status: 'pending'
    });
    await writeAudit({ req, action: 'appointment.create.patient', entity: 'Appointment', entityId: appointment._id });
    res.status(201).json(appointment);
});

exports.patientGetMedicalRecords = asyncHandler(async (req, res) => {
    const patient = await linkOrCreatePatient(req.user);
    const records = await MedicalRecord.find({ patientId: patient._id })
        .populate('doctorId', 'fullName specialization')
        .sort({ recordedAt: -1 });
    res.json(records);
});

exports.patientGetDoctors = exports.getDoctors;

// ---------- Staff ----------
exports.staffGetPatients = asyncHandler(async (req, res) => {
    res.json(await paginated(Patient, {}, req));
});
exports.staffCreatePatient = exports.adminCreatePatient;
exports.staffUpdatePatient = exports.adminUpdatePatient;

exports.staffGetAppointments = asyncHandler(async (req, res) => {
    res.json(await paginated(Appointment, {}, req, { populate: true }));
});

exports.staffCreateAppointment = asyncHandler(async (req, res) => {
    const data = {
        patientId: req.body.patientId,
        doctorId: req.body.doctorId,
        appointmentDate: req.body.appointmentDate,
        appointmentTime: req.body.appointmentTime,
        reason: req.body.reason,
        status: req.body.status || 'pending'
    };
    const appointment = await Appointment.create(data);
    await writeAudit({ req, action: 'appointment.create.staff', entity: 'Appointment', entityId: appointment._id });
    res.status(201).json(appointment);
});

exports.staffUpdateAppointmentStatus = asyncHandler(async (req, res) => {
    const appt = await updateAppointmentStatus(
        req, req.params.id, req.body.status,
        ['pending', 'approved', 'cancelled']
    );
    res.json(appt);
});

exports.staffGetDoctors = exports.getDoctors;
