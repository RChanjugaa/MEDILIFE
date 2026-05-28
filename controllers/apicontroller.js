const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Staff = require('../models/Staff');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const { sendAppointmentEmail } = require('../utils/emailService');

const APPOINTMENT_STATUSES = ['pending', 'approved', 'completed', 'cancelled'];
const ROLES = ['admin', 'doctor', 'staff', 'patient'];

const appointmentPopulate = [
    { path: 'patientId', select: 'fullName email phone age gender bloodGroup address medicalHistory userId' },
    { path: 'doctorId', select: 'fullName email phone specialization department availability status userId' }
];

const normalizeEmail = (email) => (email || '').trim().toLowerCase();

const populateAppointmentQuery = (query) => query
    .populate(appointmentPopulate)
    .sort({ createdAt: -1 });

async function findPatientForUser(user) {
    return Patient.findOne({
        $or: [
            { userId: user._id },
            { email: normalizeEmail(user.email) }
        ]
    });
}

async function findDoctorForUser(user) {
    return Doctor.findOne({
        $or: [
            { userId: user._id },
            { email: normalizeEmail(user.email) }
        ]
    });
}

async function sendStatusEmailIfNeeded(appointment, status) {
    if (!['approved', 'cancelled'].includes(status)) return;

    const patientEmail = appointment.patientEmail || appointment.patientId?.email;
    if (!patientEmail) return;

    const emailResult = await sendAppointmentEmail({
        to: patientEmail,
        name: appointment.patientName || appointment.patientId?.fullName || 'Patient',
        doctorName: appointment.doctorId?.fullName || 'your doctor',
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        status
    });

    appointment.emailStatus = emailResult.status;
}

async function updateAppointmentStatusById(id, status, res) {
    if (!APPOINTMENT_STATUSES.includes(status)) {
        return res.status(400).json({ message: 'Invalid appointment status.' });
    }

    const appointment = await Appointment.findById(id)
        .populate('patientId', 'fullName email')
        .populate('doctorId', 'fullName');

    if (!appointment) return res.status(404).json({ message: 'Appointment not found.' });

    appointment.status = status;
    await sendStatusEmailIfNeeded(appointment, status);
    await appointment.save();
    return res.json(appointment);
}

// Public client-side website data.
exports.getDoctors = async (req, res) => {
    try {
        const doctors = await Doctor.find({ status: { $ne: 'inactive' } }).sort({ fullName: 1 });
        res.json(doctors);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.bookPublicAppointment = async (req, res) => {
    const { fullName, email, phone, doctorId, appointmentDate, appointmentTime, reason } = req.body;

    if (!fullName || !email || !doctorId || !appointmentDate || !appointmentTime) {
        return res.status(400).json({ message: 'Name, email, doctor, date, and time are required.' });
    }

    try {
        const doctor = await Doctor.findById(doctorId);
        if (!doctor) return res.status(404).json({ message: 'Doctor not found.' });

        let patient = await Patient.findOne({ email: normalizeEmail(email) });
        if (!patient) {
            patient = await Patient.create({
                fullName,
                email: normalizeEmail(email),
                phone,
                gender: req.body.gender || 'Other'
            });
        } else {
            patient.fullName = fullName;
            patient.phone = phone || patient.phone;
            await patient.save();
        }

        const appointment = await Appointment.create({
            patientId: patient._id,
            doctorId,
            appointmentDate,
            appointmentTime,
            reason,
            patientName: fullName,
            patientEmail: normalizeEmail(email),
            patientPhone: phone,
            status: 'pending'
        });

        const emailResult = await sendAppointmentEmail({
            to: normalizeEmail(email),
            name: fullName,
            doctorName: doctor.fullName,
            appointmentDate,
            appointmentTime,
            status: 'pending'
        });

        appointment.emailStatus = emailResult.status;
        await appointment.save();

        res.status(201).json({
            message: 'Appointment request received. Confirmation details have been sent when email is configured.',
            appointment
        });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// Admin routes.
exports.getAdminStats = async (req, res) => {
    try {
        const [
            patientCount,
            doctorCount,
            staffCount,
            appointmentCount,
            pendingCount,
            approvedCount,
            completedCount,
            cancelledCount,
            recentAppointments,
            recentPatients
        ] = await Promise.all([
            Patient.countDocuments(),
            Doctor.countDocuments(),
            Staff.countDocuments(),
            Appointment.countDocuments(),
            Appointment.countDocuments({ status: 'pending' }),
            Appointment.countDocuments({ status: 'approved' }),
            Appointment.countDocuments({ status: 'completed' }),
            Appointment.countDocuments({ status: 'cancelled' }),
            populateAppointmentQuery(Appointment.find().limit(6)),
            Patient.find().sort({ createdAt: -1 }).limit(6)
        ]);

        res.json({
            patientCount,
            doctorCount,
            staffCount,
            appointmentCount,
            pendingCount,
            approvedCount,
            completedCount,
            cancelledCount,
            recentAppointments,
            recentPatients
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.adminGetPatients = async (req, res) => {
    try {
        res.json(await Patient.find().sort({ createdAt: -1 }));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.adminCreatePatient = async (req, res) => {
    try {
        const patient = await Patient.create({ ...req.body, email: normalizeEmail(req.body.email) });
        res.status(201).json(patient);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.adminUpdatePatient = async (req, res) => {
    try {
        const data = { ...req.body };
        if (data.email) data.email = normalizeEmail(data.email);
        const patient = await Patient.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
        if (!patient) return res.status(404).json({ message: 'Patient not found.' });
        res.json(patient);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.adminDeletePatient = async (req, res) => {
    try {
        const patient = await Patient.findByIdAndDelete(req.params.id);
        if (!patient) return res.status(404).json({ message: 'Patient not found.' });
        await Appointment.deleteMany({ patientId: req.params.id });
        res.json({ message: 'Patient deleted.' });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.adminGetDoctors = async (req, res) => {
    try {
        res.json(await Doctor.find().sort({ fullName: 1 }));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.adminCreateDoctor = async (req, res) => {
    try {
        const doctor = await Doctor.create({ ...req.body, email: normalizeEmail(req.body.email) });
        res.status(201).json(doctor);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.adminUpdateDoctor = async (req, res) => {
    try {
        const data = { ...req.body };
        if (data.email) data.email = normalizeEmail(data.email);
        const doctor = await Doctor.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
        if (!doctor) return res.status(404).json({ message: 'Doctor not found.' });
        res.json(doctor);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.adminDeleteDoctor = async (req, res) => {
    try {
        const hasAppointments = await Appointment.exists({ doctorId: req.params.id });
        if (hasAppointments) {
            return res.status(400).json({ message: 'Doctor has appointments. Set status to inactive instead.' });
        }
        const doctor = await Doctor.findByIdAndDelete(req.params.id);
        if (!doctor) return res.status(404).json({ message: 'Doctor not found.' });
        res.json({ message: 'Doctor deleted.' });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.adminGetStaff = async (req, res) => {
    try {
        res.json(await Staff.find().sort({ fullName: 1 }));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.adminCreateStaff = async (req, res) => {
    try {
        const staff = await Staff.create({ ...req.body, email: normalizeEmail(req.body.email) });
        res.status(201).json(staff);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.adminUpdateStaff = async (req, res) => {
    try {
        const data = { ...req.body };
        if (data.email) data.email = normalizeEmail(data.email);
        const staff = await Staff.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
        if (!staff) return res.status(404).json({ message: 'Staff member not found.' });
        res.json(staff);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.adminDeleteStaff = async (req, res) => {
    try {
        const staff = await Staff.findByIdAndDelete(req.params.id);
        if (!staff) return res.status(404).json({ message: 'Staff member not found.' });
        res.json({ message: 'Staff member deleted.' });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.adminGetAppointments = async (req, res) => {
    try {
        res.json(await populateAppointmentQuery(Appointment.find()));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.adminUpdateAppointmentStatus = async (req, res) => {
    try {
        return updateAppointmentStatusById(req.params.id, req.body.status, res);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.adminDeleteAppointment = async (req, res) => {
    try {
        const appointment = await Appointment.findByIdAndDelete(req.params.id);
        if (!appointment) return res.status(404).json({ message: 'Appointment not found.' });
        res.json({ message: 'Appointment deleted.' });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.adminGetUsers = async (req, res) => {
    try {
        res.json(await User.find().select('-password').sort({ createdAt: -1 }));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.adminUpdateUserRole = async (req, res) => {
    const { role } = req.body;
    if (!ROLES.includes(role)) return res.status(400).json({ message: 'Invalid role.' });

    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        if (user.role === 'admin' && role !== 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin' });
            if (adminCount <= 1) {
                return res.status(400).json({ message: 'You cannot remove the last admin account.' });
            }
        }

        user.role = role;
        await user.save();
        res.json({ _id: user._id, name: user.name, email: user.email, role: user.role });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// Doctor routes.
exports.doctorGetAppointments = async (req, res) => {
    try {
        const doctor = await findDoctorForUser(req.user);
        if (!doctor) return res.json([]);
        res.json(await populateAppointmentQuery(Appointment.find({ doctorId: doctor._id })));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.doctorGetPatients = async (req, res) => {
    try {
        const doctor = await findDoctorForUser(req.user);
        if (!doctor) return res.json([]);

        const appointments = await Appointment.find({ doctorId: doctor._id }).distinct('patientId');
        const patients = await Patient.find({ _id: { $in: appointments } }).sort({ fullName: 1 });
        res.json(patients);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.doctorUpdateMedicalNotes = async (req, res) => {
    try {
        const doctor = await findDoctorForUser(req.user);
        if (!doctor) return res.status(404).json({ message: 'Doctor profile not found.' });

        const appointment = await Appointment.findOne({ _id: req.params.id, doctorId: doctor._id });
        if (!appointment) return res.status(404).json({ message: 'Appointment not found for this doctor.' });

        appointment.diagnosisNotes = req.body.diagnosisNotes || '';
        appointment.prescription = req.body.prescription || '';
        await appointment.save();
        res.json(appointment);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.doctorCompleteAppointment = async (req, res) => {
    try {
        const doctor = await findDoctorForUser(req.user);
        if (!doctor) return res.status(404).json({ message: 'Doctor profile not found.' });

        const appointment = await Appointment.findOne({ _id: req.params.id, doctorId: doctor._id });
        if (!appointment) return res.status(404).json({ message: 'Appointment not found for this doctor.' });

        appointment.status = 'completed';
        await appointment.save();
        res.json(appointment);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// Patient routes.
exports.patientGetProfile = async (req, res) => {
    try {
        let patient = await findPatientForUser(req.user);
        if (!patient) {
            patient = await Patient.create({
                userId: req.user._id,
                fullName: req.user.name,
                email: normalizeEmail(req.user.email),
                gender: 'Other'
            });
        } else if (!patient.userId) {
            patient.userId = req.user._id;
            await patient.save();
        }
        res.json(patient);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.patientGetAppointments = async (req, res) => {
    try {
        const patient = await findPatientForUser(req.user);
        if (!patient) return res.json([]);
        res.json(await populateAppointmentQuery(Appointment.find({ patientId: patient._id })));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.patientBookAppointment = async (req, res) => {
    const { doctorId, appointmentDate, appointmentTime, reason } = req.body;
    if (!doctorId || !appointmentDate || !appointmentTime) {
        return res.status(400).json({ message: 'Doctor, date, and time are required.' });
    }

    try {
        const doctor = await Doctor.findById(doctorId);
        if (!doctor) return res.status(404).json({ message: 'Doctor not found.' });

        let patient = await findPatientForUser(req.user);
        if (!patient) {
            patient = await Patient.create({
                userId: req.user._id,
                fullName: req.user.name,
                email: normalizeEmail(req.user.email),
                gender: 'Other'
            });
        } else if (!patient.userId) {
            patient.userId = req.user._id;
            await patient.save();
        }

        const appointment = await Appointment.create({
            patientId: patient._id,
            doctorId,
            appointmentDate,
            appointmentTime,
            reason,
            patientName: patient.fullName,
            patientEmail: patient.email,
            patientPhone: patient.phone,
            status: 'pending'
        });

        res.status(201).json(appointment);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.patientGetDoctors = exports.getDoctors;

// Staff routes.
exports.staffGetPatients = async (req, res) => {
    try {
        res.json(await Patient.find().sort({ createdAt: -1 }));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.staffCreatePatient = exports.adminCreatePatient;
exports.staffUpdatePatient = exports.adminUpdatePatient;

exports.staffGetAppointments = async (req, res) => {
    try {
        res.json(await populateAppointmentQuery(Appointment.find()));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.staffCreateAppointment = async (req, res) => {
    try {
        const appointment = await Appointment.create({ ...req.body, status: req.body.status || 'pending' });
        res.status(201).json(appointment);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.staffUpdateAppointmentStatus = async (req, res) => {
    try {
        if (!['pending', 'approved', 'cancelled'].includes(req.body.status)) {
            return res.status(400).json({ message: 'Staff can only set pending, approved, or cancelled.' });
        }
        return updateAppointmentStatusById(req.params.id, req.body.status, res);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.staffGetDoctors = exports.getDoctors;

// Backward-compatible routes with safe role scoping.
exports.getPatients = async (req, res) => {
    if (req.user.role === 'admin' || req.user.role === 'staff') return exports.staffGetPatients(req, res);
    if (req.user.role === 'doctor') return exports.doctorGetPatients(req, res);
    if (req.user.role === 'patient') {
        const patient = await findPatientForUser(req.user);
        return res.json(patient ? [patient] : []);
    }
    return res.status(403).json({ message: 'Not authorized.' });
};

exports.createPatient = async (req, res) => {
    if (!['admin', 'staff'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Only admin and staff can add patients.' });
    }
    return exports.adminCreatePatient(req, res);
};

exports.getAppointments = async (req, res) => {
    if (req.user.role === 'admin' || req.user.role === 'staff') return exports.staffGetAppointments(req, res);
    if (req.user.role === 'doctor') return exports.doctorGetAppointments(req, res);
    if (req.user.role === 'patient') return exports.patientGetAppointments(req, res);
    return res.status(403).json({ message: 'Not authorized.' });
};

exports.bookAppointment = async (req, res) => {
    if (req.user.role === 'patient') return exports.patientBookAppointment(req, res);
    if (req.user.role === 'staff' || req.user.role === 'admin') return exports.staffCreateAppointment(req, res);
    return res.status(403).json({ message: 'Doctors cannot book appointments from this route.' });
};

exports.updateAppointmentStatus = async (req, res) => {
    if (req.user.role === 'admin') return exports.adminUpdateAppointmentStatus(req, res);
    if (req.user.role === 'staff') return exports.staffUpdateAppointmentStatus(req, res);
    return res.status(403).json({ message: 'Not authorized to update appointment status.' });
};
