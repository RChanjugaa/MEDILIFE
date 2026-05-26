const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Staff = require('../models/Staff');
const Appointment = require('../models/Appointment');
const { sendAppointmentEmail } = require('../utils/emailService');

// --- PATIENT CONTROLLERS ---
exports.getPatients = async (req, res) => {
    try {
        const patients = await Patient.find();
        res.json(patients);
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.createPatient = async (req, res) => {
    try {
        const patient = new Patient(req.body);
        await patient.save();
        res.status(201).json(patient);
    } catch (err) { res.status(400).json({ message: err.message }); }
};

// --- DOCTOR CONTROLLERS ---
exports.getDoctors = async (req, res) => {
    try {
        const doctors = await Doctor.find();
        res.json(doctors);
    } catch (err) { res.status(500).json({ message: err.message }); }
};

// --- APPOINTMENT CONTROLLERS ---
exports.bookAppointment = async (req, res) => {
    try {
        const appointment = new Appointment(req.body);
        await appointment.save();
        res.status(201).json(appointment);
    } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.bookPublicAppointment = async (req, res) => {
    const {
        fullName,
        email,
        phone,
        doctorId,
        appointmentDate,
        appointmentTime,
        reason
    } = req.body;

    if (!fullName || !email || !doctorId || !appointmentDate || !appointmentTime) {
        return res.status(400).json({ message: 'Name, email, doctor, date, and time are required.' });
    }

    try {
        const doctor = await Doctor.findById(doctorId);
        if (!doctor) return res.status(404).json({ message: 'Doctor not found.' });

        let patient = await Patient.findOne({ email });
        if (!patient) {
            patient = await Patient.create({
                fullName,
                email,
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
            patientEmail: email,
            patientPhone: phone,
            status: 'pending'
        });

        const emailResult = await sendAppointmentEmail({
            to: email,
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

exports.getAppointments = async (req, res) => {
    try {
        // .populate links the IDs to actual names from other collections
        const appointments = await Appointment.find()
            .populate('patientId', 'fullName')
            .populate('doctorId', 'fullName specialization')
            .sort({ createdAt: -1 });
        res.json(appointments);
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.updateAppointmentStatus = async (req, res) => {
    const { status } = req.body;
    const allowedStatuses = ['pending', 'approved', 'completed', 'cancelled'];
    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid appointment status.' });
    }

    try {
        const appointment = await Appointment.findById(req.params.id)
            .populate('patientId', 'fullName email')
            .populate('doctorId', 'fullName');

        if (!appointment) return res.status(404).json({ message: 'Appointment not found.' });

        appointment.status = status;
        const patientEmail = appointment.patientEmail || (appointment.patientId && appointment.patientId.email);
        const patientName = appointment.patientName || (appointment.patientId && appointment.patientId.fullName);
        if (patientEmail && (status === 'approved' || status === 'cancelled')) {
            const emailResult = await sendAppointmentEmail({
                to: patientEmail,
                name: patientName || 'Patient',
                doctorName: appointment.doctorId ? appointment.doctorId.fullName : 'your doctor',
                appointmentDate: appointment.appointmentDate,
                appointmentTime: appointment.appointmentTime,
                status
            });
            appointment.emailStatus = emailResult.status;
        }

        await appointment.save();
        res.json(appointment);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// --- DASHBOARD STATS ---
exports.getAdminStats = async (req, res) => {
    try {
        const patientCount = await Patient.countDocuments();
        const doctorCount = await Doctor.countDocuments();
        const staffCount = await Staff.countDocuments();
        const appointmentCount = await Appointment.countDocuments();
        res.json({ patientCount, doctorCount, staffCount, appointmentCount });
    } catch (err) { res.status(500).json({ message: err.message }); }
};
