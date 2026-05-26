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

    function showError(message) {
        $('#dashboardAlert')
            .removeClass('d-none')
            .text(message || 'Unable to load dashboard data.');
    }

    function authHeaders() {
        return { Authorization: 'Bearer ' + token };
    }

    function renderEmpty(selector, colspan, message) {
        $(selector).html(`<tr><td colspan="${colspan}" class="text-muted">${message}</td></tr>`);
    }

    function loadDoctors() {
        $.ajax({
            url: '/api/doctors',
            headers: authHeaders(),
            success: function(doctors) {
                if (!doctors.length) {
                    renderEmpty('#doctorTableBody', 3, 'No doctors found yet.');
                    return;
                }

                $('#doctorTableBody').html(doctors.map(doctor => `
                    <tr>
                        <td>${doctor.fullName}</td>
                        <td>${doctor.specialization || 'General'}</td>
                        <td>${doctor.availability || '9:00 AM - 5:00 PM'}</td>
                    </tr>
                `).join(''));
            },
            error: function(err) {
                showError(err.responseJSON && err.responseJSON.message);
            }
        });
    }

    function loadPatients() {
        $.ajax({
            url: '/api/patients',
            headers: authHeaders(),
            success: function(patients) {
                if (!patients.length) {
                    renderEmpty('#patientTableBody', 3, 'No patients found yet.');
                    return;
                }

                $('#patientTableBody').html(patients.map(patient => `
                    <tr>
                        <td>${patient.fullName}</td>
                        <td>${patient.email}</td>
                        <td>${patient.phone || 'N/A'}</td>
                    </tr>
                `).join(''));
            },
            error: function(err) {
                showError(err.responseJSON && err.responseJSON.message);
            }
        });
    }

    function loadAppointments() {
        $.ajax({
            url: '/api/appointments',
            headers: authHeaders(),
            success: function(appointments) {
                $('#appointmentCount').text(appointments.length);

                if (!appointments.length) {
                    renderEmpty('#appointmentTableBody', 4, 'No appointments found yet.');
                    return;
                }

                $('#appointmentTableBody').html(appointments.map(appointment => `
                    <tr>
                        <td>${appointment.patientId ? appointment.patientId.fullName : 'Patient'}</td>
                        <td>${appointment.doctorId ? appointment.doctorId.fullName : 'Doctor'}</td>
                        <td>${appointment.appointmentDate} ${appointment.appointmentTime}</td>
                        <td><span class="badge bg-secondary">${appointment.status}</span></td>
                    </tr>
                `).join(''));
            },
            error: function(err) {
                showError(err.responseJSON && err.responseJSON.message);
            }
        });
    }

    if ($('#doctorTableBody').length) loadDoctors();
    if ($('#patientTableBody').length) loadPatients();
    if ($('#appointmentTableBody').length) loadAppointments();
});
