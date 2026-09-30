const express = require('express');
const router = express.Router();
const api = require('../controllers/apicontroller');
const { protect, authorize } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const V = require('../validators');

// ---------- Public ----------
router.get('/public/doctors', api.getDoctors);
router.get('/public/doctors/:id/slots', api.getDoctorSlots);
router.post('/public/appointments', validate(V.publicAppointmentSchema), api.bookPublicAppointment);

// ---------- Admin ----------
router.get('/admin/stats', protect, authorize('admin'), api.getAdminStats);

router.get('/admin/patients', protect, authorize('admin'), api.adminGetPatients);
router.post('/admin/patients', protect, authorize('admin'), validate(V.patientUpsertSchema), api.adminCreatePatient);
router.put('/admin/patients/:id', protect, authorize('admin'), validate(V.patientUpsertSchema), api.adminUpdatePatient);
router.delete('/admin/patients/:id', protect, authorize('admin'), api.adminDeletePatient);

router.get('/admin/doctors', protect, authorize('admin'), api.adminGetDoctors);
router.post('/admin/doctors', protect, authorize('admin'), validate(V.doctorUpsertSchema), api.adminCreateDoctor);
router.put('/admin/doctors/:id', protect, authorize('admin'), validate(V.doctorUpsertSchema), api.adminUpdateDoctor);
router.delete('/admin/doctors/:id', protect, authorize('admin'), api.adminDeleteDoctor);

router.get('/admin/staff', protect, authorize('admin'), api.adminGetStaff);
router.post('/admin/staff', protect, authorize('admin'), validate(V.staffUpsertSchema), api.adminCreateStaff);
router.put('/admin/staff/:id', protect, authorize('admin'), validate(V.staffUpsertSchema), api.adminUpdateStaff);
router.delete('/admin/staff/:id', protect, authorize('admin'), api.adminDeleteStaff);

router.get('/admin/appointments', protect, authorize('admin'), api.adminGetAppointments);
router.patch('/admin/appointments/:id/status', protect, authorize('admin'), validate(V.appointmentStatusSchema), api.adminUpdateAppointmentStatus);
router.delete('/admin/appointments/:id', protect, authorize('admin'), api.adminDeleteAppointment);

router.get('/admin/users', protect, authorize('admin'), api.adminGetUsers);
router.patch('/admin/users/:id/role', protect, authorize('admin'), validate(V.userRoleSchema), api.adminUpdateUserRole);

// ---------- Doctor ----------
router.get('/doctor/appointments', protect, authorize('doctor'), api.doctorGetAppointments);
router.get('/doctor/patients', protect, authorize('doctor'), api.doctorGetPatients);
router.patch('/doctor/appointments/:id/medical-notes', protect, authorize('doctor'), validate(V.medicalNotesSchema), api.doctorUpdateMedicalNotes);
router.patch('/doctor/appointments/:id/complete', protect, authorize('doctor'), api.doctorCompleteAppointment);

// ---------- Patient ----------
router.get('/patient/profile', protect, authorize('patient'), api.patientGetProfile);
router.get('/patient/appointments', protect, authorize('patient'), api.patientGetAppointments);
router.post('/patient/appointments', protect, authorize('patient'), validate(V.patientBookingSchema), api.patientBookAppointment);
router.get('/patient/doctors', protect, authorize('patient'), api.patientGetDoctors);
router.get('/patient/medical-records', protect, authorize('patient'), api.patientGetMedicalRecords);

// ---------- Staff ----------
router.get('/staff/patients', protect, authorize('staff'), api.staffGetPatients);
router.post('/staff/patients', protect, authorize('staff'), validate(V.patientUpsertSchema), api.staffCreatePatient);
router.put('/staff/patients/:id', protect, authorize('staff'), validate(V.patientUpsertSchema), api.staffUpdatePatient);
router.get('/staff/appointments', protect, authorize('staff'), api.staffGetAppointments);
router.post('/staff/appointments', protect, authorize('staff'), api.staffCreateAppointment);
router.patch('/staff/appointments/:id/status', protect, authorize('staff'), validate(V.appointmentStatusSchema), api.staffUpdateAppointmentStatus);
router.get('/staff/doctors', protect, authorize('staff'), api.staffGetDoctors);

// ---------- Convenience (legacy paths kept, route via role-specific handlers) ----------
router.get('/dashboard/admin-stats', protect, authorize('admin'), api.getAdminStats);
router.get('/doctors', protect, api.getDoctors);

module.exports = router;
