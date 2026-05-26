$(document).ready(function() {
    // 1. Protection: Redirect if no token
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    if (role !== 'admin') {
        window.location.href = `${role || 'patient'}-dashboard.html`;
        return;
    }

    $('#adminName').text(localStorage.getItem('userName'));

    function showDashboardError(message) {
        $('#dashboardError')
            .removeClass('d-none')
            .text(message || 'Unable to load dashboard data.');
    }

    // 2. Load Stats
    function loadStats() {
        $.ajax({
            url: '/api/dashboard/admin-stats',
            headers: { 'Authorization': 'Bearer ' + token },
            success: function(data) {
                $('#count-patients').text(data.patientCount);
                $('#count-doctors').text(data.doctorCount);
                $('#count-appointments').text(data.appointmentCount);
                $('#count-staff').text(data.staffCount);
            },
            error: function(err) {
                showDashboardError(err.responseJSON && err.responseJSON.message);
            }
        });
    }

    // 3. Load Patients Table
    window.loadPatients = function() {
        $.ajax({
            url: '/api/patients',
            headers: { 'Authorization': 'Bearer ' + token },
            success: function(patients) {
                let html = '';
                patients.forEach(p => {
                    html += `
                        <tr>
                            <td>${p.fullName}</td>
                            <td>${p.email}</td>
                            <td>${p.phone || 'N/A'}</td>
                            <td><span class="badge bg-info">${p.bloodGroup || 'O+'}</span></td>
                        </tr>`;
                });
                $('#patientTableBody').html(html);
            },
            error: function(err) {
                showDashboardError(err.responseJSON && err.responseJSON.message);
            }
        });
    }

    window.loadEmr = function() {
        $.ajax({
            url: '/api/patients',
            headers: { 'Authorization': 'Bearer ' + token },
            success: function(patients) {
                if (!patients.length) {
                    $('#emrTableBody').html('<tr><td colspan="4" class="text-muted">No patient records yet.</td></tr>');
                    return;
                }

                $('#emrTableBody').html(patients.map(patient => `
                    <tr>
                        <td><strong>${patient.fullName}</strong><br><small class="text-muted">${patient.gender || 'Not specified'}</small></td>
                        <td>${patient.email}<br><small>${patient.phone || 'N/A'}</small></td>
                        <td><span class="badge bg-info">${patient.bloodGroup || 'Not set'}</span></td>
                        <td>${patient.medicalHistory || 'None'}</td>
                    </tr>
                `).join(''));
            },
            error: function(err) {
                showDashboardError(err.responseJSON && err.responseJSON.message);
            }
        });
    }

    window.loadAppointments = function() {
        $.ajax({
            url: '/api/appointments',
            headers: { 'Authorization': 'Bearer ' + token },
            success: function(appointments) {
                if (!appointments.length) {
                    $('#appointmentTableBody').html('<tr><td colspan="6" class="text-muted">No appointment requests yet.</td></tr>');
                    return;
                }

                $('#appointmentTableBody').html(appointments.map(appointment => {
                    const patient = appointment.patientName || (appointment.patientId && appointment.patientId.fullName) || 'Patient';
                    const doctor = appointment.doctorId ? appointment.doctorId.fullName : 'Doctor';
                    const canApprove = appointment.status === 'pending';
                    return `
                        <tr>
                            <td>
                                <strong>${patient}</strong><br>
                                <small class="text-muted">${appointment.patientEmail || ''}</small>
                            </td>
                            <td>${doctor}</td>
                            <td>${appointment.appointmentDate}<br><small>${appointment.appointmentTime}</small></td>
                            <td>${appointment.reason || 'N/A'}</td>
                            <td><span class="badge bg-${appointment.status === 'approved' ? 'success' : appointment.status === 'cancelled' ? 'danger' : 'secondary'}">${appointment.status}</span></td>
                            <td>
                                <div class="btn-group btn-group-sm">
                                    <button class="btn btn-outline-success" ${canApprove ? '' : 'disabled'} onclick="updateAppointmentStatus('${appointment._id}', 'approved')">Approve</button>
                                    <button class="btn btn-outline-danger" onclick="updateAppointmentStatus('${appointment._id}', 'cancelled')">Cancel</button>
                                </div>
                            </td>
                        </tr>`;
                }).join(''));
            },
            error: function(err) {
                showDashboardError(err.responseJSON && err.responseJSON.message);
            }
        });
    }

    window.loadDoctors = function() {
        $.ajax({
            url: '/api/doctors',
            headers: { 'Authorization': 'Bearer ' + token },
            success: function(doctors) {
                if (!doctors.length) {
                    $('#doctorTableBody').html('<tr><td colspan="4" class="text-muted">No doctors found yet.</td></tr>');
                    return;
                }

                $('#doctorTableBody').html(doctors.map(doctor => `
                    <tr>
                        <td>${doctor.fullName}</td>
                        <td>${doctor.specialization || 'General'}</td>
                        <td>${doctor.department || 'N/A'}</td>
                        <td>${doctor.availability || '9:00 AM - 5:00 PM'}</td>
                    </tr>
                `).join(''));
            },
            error: function(err) {
                showDashboardError(err.responseJSON && err.responseJSON.message);
            }
        });
    }

    window.updateAppointmentStatus = function(id, status) {
        $.ajax({
            url: `/api/appointments/${id}/status`,
            method: 'PATCH',
            headers: { 'Authorization': 'Bearer ' + token },
            contentType: 'application/json',
            data: JSON.stringify({ status }),
            success: function() {
                loadAppointments();
                loadStats();
            },
            error: function(err) {
                showDashboardError(err.responseJSON && err.responseJSON.message);
            }
        });
    }

    window.loadBilling = function() {
        $.ajax({
            url: '/api/appointments',
            headers: { 'Authorization': 'Bearer ' + token },
            success: function(appointments) {
                const billable = appointments.filter(item => item.status === 'approved' || item.status === 'completed');
                const claims = Math.ceil(billable.length * 0.45);
                $('#billing-approved').text(billable.length);
                $('#billing-revenue').text(`LKR ${(billable.length * 3500).toLocaleString()}`);
                $('#billing-claims').text(claims);
            },
            error: function(err) {
                showDashboardError(err.responseJSON && err.responseJSON.message);
            }
        });
    }

    window.loadReports = function() {
        $.ajax({
            url: '/api/appointments',
            headers: { 'Authorization': 'Bearer ' + token },
            success: function(appointments) {
                const statuses = appointments.reduce((acc, item) => {
                    acc[item.status] = (acc[item.status] || 0) + 1;
                    return acc;
                }, {});
                const cards = [
                    ['Pending Appointments', statuses.pending || 0, 'Patients waiting for admin confirmation'],
                    ['Approved Appointments', statuses.approved || 0, 'Confirmed care visits'],
                    ['Completed Visits', statuses.completed || 0, 'Finished patient care sessions'],
                    ['Cancelled Requests', statuses.cancelled || 0, 'Requests that did not proceed']
                ];
                $('#reportCards').html(cards.map(card => `
                    <article class="report-card">
                        <span>${card[0]}</span>
                        <strong>${card[1]}</strong>
                        <small>${card[2]}</small>
                    </article>
                `).join(''));
            },
            error: function(err) {
                showDashboardError(err.responseJSON && err.responseJSON.message);
            }
        });
    }

    // 4. Handle Patient Form Submission
    $('#addPatientForm').on('submit', function(e) {
        e.preventDefault();
        const patientData = {
            fullName: $('#p_name').val(),
            email: $('#p_email').val(),
            phone: $('#p_phone').val(),
            gender: $('#p_gender').val()
        };

        $.ajax({
            url: '/api/patients',
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            contentType: 'application/json',
            data: JSON.stringify(patientData),
            success: function() {
                $('#patientModal').modal('hide');
                loadPatients();
                loadStats();
                alert('Patient Added Successfully');
            },
            error: function(err) {
                showDashboardError(err.responseJSON && err.responseJSON.message);
            }
        });
    });

    // 5. Section Toggler
    window.showSection = function(section) {
        $('#dashboard-stats').addClass('d-none');
        $('#patients-section').addClass('d-none');
        $('#doctors-section').addClass('d-none');
        $('#appointments-section').addClass('d-none');
        $('#emr-section').addClass('d-none');
        $('#billing-section').addClass('d-none');
        $('#reports-section').addClass('d-none');
        $('#locations-section').addClass('d-none');
        $('#security-section').addClass('d-none');
        $('#hms-overview').addClass('d-none');
        
        if(section === 'patients') {
            $('#patients-section').removeClass('d-none');
            loadPatients();
        } else if(section === 'appointments') {
            $('#appointments-section').removeClass('d-none');
            loadAppointments();
        } else if(section === 'doctors') {
            $('#doctors-section').removeClass('d-none');
            loadDoctors();
        } else if(section === 'emr') {
            $('#emr-section').removeClass('d-none');
            loadEmr();
        } else if(section === 'billing') {
            $('#billing-section').removeClass('d-none');
            loadBilling();
        } else if(section === 'reports') {
            $('#reports-section').removeClass('d-none');
            loadReports();
        } else if(section === 'locations') {
            $('#locations-section').removeClass('d-none');
        } else if(section === 'security') {
            $('#security-section').removeClass('d-none');
        } else {
            $('#dashboard-stats').removeClass('d-none');
            $('#hms-overview').removeClass('d-none');
        }
    };

    loadStats();
});
