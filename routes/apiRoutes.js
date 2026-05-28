const express = require('express');
const router = express.Router();
const api = require('../controllers/apicontroller');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public client-side website data.
router.get('/public/doctors', api.getDoctors);
router.post('/public/appointments', api.bookPublicAppointment);

// Admin routes: full system access.
router.get('/admin/stats', protect, authorize('admin'), api.getAdminStats);
router.get('/admin/patients', protect, authorize('admin'), api.adminGetPatients);
router.post('/admin/patients', protect, authorize('admin'), api.adminCreatePatient);
router.put('/admin/patients/:id', protect, authorize('admin'), api.adminUpdatePatient);
router.delete('/admin/patients/:id', protect, authorize('admin'), api.adminDeletePatient);
router.get('/admin/doctors', protect, authorize('admin'), api.adminGetDoctors);
router.post('/admin/doctors', protect, authorize('admin'), api.adminCreateDoctor);
router.put('/admin/doctors/:id', protect, authorize('admin'), api.adminUpdateDoctor);
router.delete('/admin/doctors/:id', protect, authorize('admin'), api.adminDeleteDoctor);
router.get('/admin/staff', protect, authorize('admin'), api.adminGetStaff);
router.post('/admin/staff', protect, authorize('admin'), api.adminCreateStaff);
router.put('/admin/staff/:id', protect, authorize('admin'), api.adminUpdateStaff);
router.delete('/admin/staff/:id', protect, authorize('admin'), api.adminDeleteStaff);
router.get('/admin/appointments', protect, authorize('admin'), api.adminGetAppointments);
router.patch('/admin/appointments/:id/status', protect, authorize('admin'), api.adminUpdateAppointmentStatus);
router.delete('/admin/appointments/:id', protect, authorize('admin'), api.adminDeleteAppointment);
router.get('/admin/users', protect, authorize('admin'), api.adminGetUsers);
router.patch('/admin/users/:id/role', protect, authorize('admin'), api.adminUpdateUserRole);

// Doctor routes: only this doctor's appointments and linked patients.
router.get('/doctor/appointments', protect, authorize('doctor'), api.doctorGetAppointments);
router.get('/doctor/patients', protect, authorize('doctor'), api.doctorGetPatients);
router.patch('/doctor/appointments/:id/medical-notes', protect, authorize('doctor'), api.doctorUpdateMedicalNotes);
router.patch('/doctor/appointments/:id/complete', protect, authorize('doctor'), api.doctorCompleteAppointment);

// Patient routes: only this patient's profile and appointments.
router.get('/patient/profile', protect, authorize('patient'), api.patientGetProfile);
router.get('/patient/appointments', protect, authorize('patient'), api.patientGetAppointments);
router.post('/patient/appointments', protect, authorize('patient'), api.patientBookAppointment);
router.get('/patient/doctors', protect, authorize('patient'), api.patientGetDoctors);

// Staff routes: front desk access without delete/user/doctor/staff management.
router.get('/staff/patients', protect, authorize('staff'), api.staffGetPatients);
router.post('/staff/patients', protect, authorize('staff'), api.staffCreatePatient);
router.put('/staff/patients/:id', protect, authorize('staff'), api.staffUpdatePatient);
router.get('/staff/appointments', protect, authorize('staff'), api.staffGetAppointments);
router.post('/staff/appointments', protect, authorize('staff'), api.staffCreateAppointment);
router.patch('/staff/appointments/:id/status', protect, authorize('staff'), api.staffUpdateAppointmentStatus);
router.get('/staff/doctors', protect, authorize('staff'), api.staffGetDoctors);

// Backward-compatible routes. These remain protected and are scoped by role in the controller.
router.get('/dashboard/admin-stats', protect, authorize('admin'), api.getAdminStats);
router.get('/patients', protect, api.getPatients);
router.post('/patients', protect, authorize('admin', 'staff'), api.createPatient);
router.get('/doctors', protect, api.getDoctors);
router.get('/appointments', protect, api.getAppointments);
router.post('/appointments', protect, api.bookAppointment);
router.patch('/appointments/:id/status', protect, authorize('admin', 'staff'), api.updateAppointmentStatus);

module.exports = router;
