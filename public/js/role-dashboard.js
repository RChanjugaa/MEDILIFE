$(document).ready(function() {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const userName = localStorage.getItem('userName') || 'User';
    const pageRole = $('body').data('role');

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    if (pageRole && role !== pageRole) {
        const paths = {
            admin: 'admin-dashboard.html',
            doctor: 'doctor-dashboard.html',
            patient: 'patient-dashboard.html',
            staff: 'staff-dashboard.html'
        };
        window.location.href = paths[role] || 'patient-dashboard.html';
        return;
    }

    $('#userName').text(userName);

    function headers() {
        return { Authorization: 'Bearer ' + token };
    }

    function showError(message) {
        $('#dashboardAlert')
            .removeClass('d-none alert-success')
            .addClass('alert-danger')
            .text(message || 'Unable to load dashboard data.');
    }

    function showSuccess(message) {
        $('#dashboardAlert')
            .removeClass('d-none alert-danger')
            .addClass('alert-success')
            .text(message);
        setTimeout(() => $('#dashboardAlert').addClass('d-none'), 3000);
    }

    function apiRequest(url, options = {}) {
        return $.ajax({
            url,
            method: options.method || 'GET',
            headers: headers(),
            contentType: 'application/json',
            data: options.data ? JSON.stringify(options.data) : undefined
        });
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, function(char) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char];
        });
    }

    function statusBadge(status) {
        const classes = {
            pending: 'bg-warning text-dark',
            approved: 'bg-primary',
            completed: 'bg-success',
            cancelled: 'bg-danger'
        };
        return `<span class="badge ${classes[status] || 'bg-secondary'}">${status || 'pending'}</span>`;
    }

    function renderEmpty(selector, colspan, message) {
        $(selector).html(`<tr><td colspan="${colspan}" class="text-muted">${message}</td></tr>`);
    }

    function countByStatus(appointments) {
        const counts = appointments.reduce((acc, appointment) => {
            acc[appointment.status] = (acc[appointment.status] || 0) + 1;
            return acc;
        }, {});
        $('#todayCount').text(appointments.filter(item => item.appointmentDate === new Date().toISOString().split('T')[0]).length);
        $('#approvedCount').text(counts.approved || 0);
        $('#completedCount').text(counts.completed || 0);
        $('#pendingCount').text(counts.pending || 0);
        $('#appointmentCount').text(appointments.length);
    }

    function loadDoctorDashboard() {
        $.when(
            apiRequest('/api/doctor/appointments'),
            apiRequest('/api/doctor/patients')
        ).done(function(appointmentResult, patientResult) {
            const appointments = appointmentResult[0];
            const patients = patientResult[0];
            countByStatus(appointments);
            $('#assignedPatientCount').text(patients.length);
            renderDoctorAppointments(appointments);
            renderDoctorPatients(patients);
        }).fail(err => showError(err.responseJSON && err.responseJSON.message));
    }

    function renderDoctorAppointments(appointments) {
        if (!appointments.length) return renderEmpty('#appointmentTableBody', 6, 'No appointments assigned yet.');
        $('#appointmentTableBody').html(appointments.map(appointment => `
            <tr>
                <td>${escapeHtml(appointment.patientId?.fullName || appointment.patientName || 'Patient')}</td>
                <td>${escapeHtml(appointment.appointmentDate)}<br><small>${escapeHtml(appointment.appointmentTime)}</small></td>
                <td>${escapeHtml(appointment.reason || 'N/A')}</td>
                <td>${statusBadge(appointment.status)}</td>
                <td>${escapeHtml(appointment.diagnosisNotes || 'No notes yet')}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" data-note-id="${appointment._id}">Notes</button>
                    <button class="btn btn-sm btn-outline-success" data-complete-id="${appointment._id}">Complete</button>
                </td>
            </tr>
        `).join(''));
    }

    function renderDoctorPatients(patients) {
        if (!patients.length) return renderEmpty('#patientTableBody', 4, 'No assigned patients yet.');
        $('#patientTableBody').html(patients.map(patient => `
            <tr>
                <td>${escapeHtml(patient.fullName)}</td>
                <td>${escapeHtml(patient.email)}</td>
                <td>${escapeHtml(patient.phone || 'N/A')}</td>
                <td>${escapeHtml(patient.medicalHistory || 'None')}</td>
            </tr>
        `).join(''));
    }

    function loadPatientDashboard() {
        $.when(
            apiRequest('/api/patient/profile'),
            apiRequest('/api/patient/doctors'),
            apiRequest('/api/patient/appointments')
        ).done(function(profileResult, doctorResult, appointmentResult) {
            const profile = profileResult[0];
            const doctors = doctorResult[0];
            const appointments = appointmentResult[0];
            renderProfile(profile);
            renderPatientDoctors(doctors);
            renderPatientAppointments(appointments);
            countByStatus(appointments);
        }).fail(err => showError(err.responseJSON && err.responseJSON.message));
    }

    function renderProfile(profile) {
        $('#profileName').text(profile.fullName || userName);
        $('#profileEmail').text(profile.email || 'N/A');
        $('#profilePhone').text(profile.phone || 'N/A');
        $('#profileBlood').text(profile.bloodGroup || 'N/A');
    }

    function renderPatientDoctors(doctors) {
        const options = doctors.map(doctor => `<option value="${doctor._id}">${escapeHtml(doctor.fullName)} - ${escapeHtml(doctor.specialization || 'General')}</option>`).join('');
        $('#bookingDoctor').html('<option value="">Select doctor</option>' + options);

        if (!doctors.length) return renderEmpty('#doctorTableBody', 4, 'No doctors available.');
        $('#doctorTableBody').html(doctors.map(doctor => `
            <tr>
                <td>${escapeHtml(doctor.fullName)}</td>
                <td>${escapeHtml(doctor.specialization || 'General')}</td>
                <td>${escapeHtml(doctor.department || 'N/A')}</td>
                <td>${escapeHtml(doctor.availability || 'N/A')}</td>
            </tr>
        `).join(''));
    }

    function renderPatientAppointments(appointments) {
        $('#appointmentCount').text(appointments.length);
        if (!appointments.length) return renderEmpty('#appointmentTableBody', 6, 'No appointments booked yet.');
        $('#appointmentTableBody').html(appointments.map(appointment => `
            <tr>
                <td>${escapeHtml(appointment.doctorId?.fullName || 'Doctor')}</td>
                <td>${escapeHtml(appointment.appointmentDate)}<br><small>${escapeHtml(appointment.appointmentTime)}</small></td>
                <td>${escapeHtml(appointment.reason || 'N/A')}</td>
                <td>${statusBadge(appointment.status)}</td>
                <td>${escapeHtml(appointment.diagnosisNotes || 'Not added yet')}</td>
                <td>${escapeHtml(appointment.prescription || 'Not added yet')}</td>
            </tr>
        `).join(''));
    }

    function loadStaffDashboard() {
        $.when(
            apiRequest('/api/staff/patients'),
            apiRequest('/api/staff/doctors'),
            apiRequest('/api/staff/appointments')
        ).done(function(patientResult, doctorResult, appointmentResult) {
            const patients = patientResult[0];
            const doctors = doctorResult[0];
            const appointments = appointmentResult[0];
            $('#patientCount').text(patients.length);
            countByStatus(appointments);
            renderStaffPatients(patients);
            renderStaffDoctors(doctors);
            renderStaffAppointments(appointments);
            fillStaffSelects(patients, doctors);
        }).fail(err => showError(err.responseJSON && err.responseJSON.message));
    }

    function renderStaffPatients(patients) {
        if (!patients.length) return renderEmpty('#patientTableBody', 4, 'No patients found.');
        $('#patientTableBody').html(patients.map(patient => `
            <tr>
                <td>${escapeHtml(patient.fullName)}</td>
                <td>${escapeHtml(patient.email)}</td>
                <td>${escapeHtml(patient.phone || 'N/A')}</td>
                <td><button class="btn btn-sm btn-outline-primary" data-staff-edit-patient="${patient._id}">Edit</button></td>
            </tr>
        `).join(''));
        window.staffPatients = patients;
    }

    function renderStaffDoctors(doctors) {
        if (!doctors.length) return renderEmpty('#doctorTableBody', 4, 'No doctors available.');
        $('#doctorTableBody').html(doctors.map(doctor => `
            <tr>
                <td>${escapeHtml(doctor.fullName)}</td>
                <td>${escapeHtml(doctor.specialization || 'General')}</td>
                <td>${escapeHtml(doctor.department || 'N/A')}</td>
                <td>${escapeHtml(doctor.availability || 'N/A')}</td>
            </tr>
        `).join(''));
    }

    function renderStaffAppointments(appointments) {
        if (!appointments.length) return renderEmpty('#appointmentTableBody', 6, 'No appointments found.');
        $('#appointmentTableBody').html(appointments.map(appointment => `
            <tr>
                <td>${escapeHtml(appointment.patientId?.fullName || appointment.patientName || 'Patient')}</td>
                <td>${escapeHtml(appointment.doctorId?.fullName || 'Doctor')}</td>
                <td>${escapeHtml(appointment.appointmentDate)}<br><small>${escapeHtml(appointment.appointmentTime)}</small></td>
                <td>${statusBadge(appointment.status)}</td>
                <td>${escapeHtml(appointment.reason || 'N/A')}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" data-staff-status="${appointment._id}" data-value="approved">Approve</button>
                    <button class="btn btn-sm btn-outline-danger" data-staff-status="${appointment._id}" data-value="cancelled">Cancel</button>
                </td>
            </tr>
        `).join(''));
    }

    function fillStaffSelects(patients, doctors) {
        $('#staffAppointmentPatient').html('<option value="">Select patient</option>' + patients.map(patient => `<option value="${patient._id}">${escapeHtml(patient.fullName)}</option>`).join(''));
        $('#staffAppointmentDoctor').html('<option value="">Select doctor</option>' + doctors.map(doctor => `<option value="${doctor._id}">${escapeHtml(doctor.fullName)}</option>`).join(''));
    }

    $('#patientBookingForm').on('submit', function(e) {
        e.preventDefault();
        const data = {
            doctorId: $('#bookingDoctor').val(),
            appointmentDate: $('#bookingDate').val(),
            appointmentTime: $('#bookingTime').val(),
            reason: $('#bookingReason').val()
        };

        apiRequest('/api/patient/appointments', { method: 'POST', data })
            .done(function() {
                $('#patientBookingForm')[0].reset();
                showSuccess('Appointment request sent.');
                loadPatientDashboard();
            })
            .fail(err => showError(err.responseJSON && err.responseJSON.message));
    });

    $('#medicalNotesForm').on('submit', function(e) {
        e.preventDefault();
        const id = $('#notesAppointmentId').val();
        apiRequest(`/api/doctor/appointments/${id}/medical-notes`, {
            method: 'PATCH',
            data: {
                diagnosisNotes: $('#diagnosisNotes').val(),
                prescription: $('#prescription').val()
            }
        }).done(function() {
            bootstrap.Modal.getInstance(document.getElementById('medicalNotesModal')).hide();
            showSuccess('Medical notes saved.');
            loadDoctorDashboard();
        }).fail(err => showError(err.responseJSON && err.responseJSON.message));
    });

    $(document).on('click', '[data-note-id]', function() {
        $('#notesAppointmentId').val($(this).data('note-id'));
        $('#diagnosisNotes').val('');
        $('#prescription').val('');
        new bootstrap.Modal(document.getElementById('medicalNotesModal')).show();
    });

    $(document).on('click', '[data-complete-id]', function() {
        apiRequest(`/api/doctor/appointments/${$(this).data('complete-id')}/complete`, { method: 'PATCH' })
            .done(function() {
                showSuccess('Appointment marked completed.');
                loadDoctorDashboard();
            })
            .fail(err => showError(err.responseJSON && err.responseJSON.message));
    });

    $('#staffPatientForm').on('submit', function(e) {
        e.preventDefault();
        const id = $('#staffPatientId').val();
        const data = {
            fullName: $('#staffPatientName').val(),
            email: $('#staffPatientEmail').val(),
            phone: $('#staffPatientPhone').val(),
            age: $('#staffPatientAge').val(),
            gender: $('#staffPatientGender').val(),
            address: $('#staffPatientAddress').val()
        };

        apiRequest(id ? `/api/staff/patients/${id}` : '/api/staff/patients', { method: id ? 'PUT' : 'POST', data })
            .done(function() {
                $('#staffPatientForm')[0].reset();
                $('#staffPatientId').val('');
                showSuccess('Patient saved.');
                loadStaffDashboard();
            })
            .fail(err => showError(err.responseJSON && err.responseJSON.message));
    });

    $(document).on('click', '[data-staff-edit-patient]', function() {
        const patient = (window.staffPatients || []).find(item => item._id === $(this).data('staff-edit-patient'));
        if (!patient) return;
        $('#staffPatientId').val(patient._id);
        $('#staffPatientName').val(patient.fullName);
        $('#staffPatientEmail').val(patient.email);
        $('#staffPatientPhone').val(patient.phone);
        $('#staffPatientAge').val(patient.age);
        $('#staffPatientGender').val(patient.gender || 'Other');
        $('#staffPatientAddress').val(patient.address);
        document.getElementById('staffPatientForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    $('#staffAppointmentForm').on('submit', function(e) {
        e.preventDefault();
        const data = {
            patientId: $('#staffAppointmentPatient').val(),
            doctorId: $('#staffAppointmentDoctor').val(),
            appointmentDate: $('#staffAppointmentDate').val(),
            appointmentTime: $('#staffAppointmentTime').val(),
            reason: $('#staffAppointmentReason').val(),
            status: 'pending'
        };

        apiRequest('/api/staff/appointments', { method: 'POST', data })
            .done(function() {
                $('#staffAppointmentForm')[0].reset();
                showSuccess('Appointment scheduled.');
                loadStaffDashboard();
            })
            .fail(err => showError(err.responseJSON && err.responseJSON.message));
    });

    $(document).on('click', '[data-staff-status]', function() {
        apiRequest(`/api/staff/appointments/${$(this).data('staff-status')}/status`, {
            method: 'PATCH',
            data: { status: $(this).data('value') }
        }).done(function() {
            showSuccess('Appointment updated.');
            loadStaffDashboard();
        }).fail(err => showError(err.responseJSON && err.responseJSON.message));
    });

    if (pageRole === 'doctor') loadDoctorDashboard();
    if (pageRole === 'patient') loadPatientDashboard();
    if (pageRole === 'staff') loadStaffDashboard();
});
