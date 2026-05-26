const express = require('express');
const router = express.Router();
const api = require('../controllers/apicontroller');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public client-side website data
router.get('/public/doctors', api.getDoctors);
router.post('/public/appointments', api.bookPublicAppointment);

// Dashboard (Admin only)
router.get('/dashboard/admin-stats', protect, authorize('admin'), api.getAdminStats);

// Patients
router.get('/patients', protect, api.getPatients);
router.post('/patients', protect, authorize('admin', 'staff'), api.createPatient);

// Doctors
router.get('/doctors', protect, api.getDoctors);

// Appointments
router.get('/appointments', protect, api.getAppointments);
router.post('/appointments', protect, api.bookAppointment);
router.patch('/appointments/:id/status', protect, authorize('admin', 'staff'), api.updateAppointmentStatus);

module.exports = router;
