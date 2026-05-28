$(document).ready(function() {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const adminName = localStorage.getItem('userName') || 'Admin';
    const modal = new bootstrap.Modal(document.getElementById('recordModal'));

    const state = {
        patients: [],
        doctors: [],
        staff: [],
        appointments: [],
        users: []
    };

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    if (role !== 'admin') {
        window.location.href = `${role || 'patient'}-dashboard.html`;
        return;
    }

    $('#adminName').text(adminName);

    function headers() {
        return { Authorization: 'Bearer ' + token };
    }

    function showMessage(type, message) {
        const target = type === 'success' ? '#dashboardSuccess' : '#dashboardError';
        $('#dashboardSuccess, #dashboardError').addClass('d-none').text('');
        $(target).removeClass('d-none').text(message || 'Action completed.');
        setTimeout(() => $(target).addClass('d-none'), 3500);
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

    function apiRequest(url, options = {}) {
        return $.ajax({
            url,
            method: options.method || 'GET',
            headers: headers(),
            contentType: 'application/json',
            data: options.data ? JSON.stringify(options.data) : undefined
        });
    }

    function filterRows(items, term, fields) {
        const search = (term || '').toLowerCase();
        if (!search) return items;
        return items.filter(item => fields.some(field => String(item[field] || '').toLowerCase().includes(search)));
    }

    function fillDoctorFilter() {
        const current = $('#appointmentDoctorFilter').val();
        $('#appointmentDoctorFilter').html('<option value="">All doctors</option>' + state.doctors.map(doctor => (
            `<option value="${doctor._id}">${escapeHtml(doctor.fullName)}</option>`
        )).join(''));
        $('#appointmentDoctorFilter').val(current);
    }

    function loadStats() {
        return apiRequest('/api/admin/stats')
            .done(function(data) {
                $('#count-patients').text(data.patientCount);
                $('#count-doctors').text(data.doctorCount);
                $('#count-staff').text(data.staffCount);
                $('#count-appointments').text(data.appointmentCount);
                $('#count-pending').text(data.pendingCount);
                $('#count-approved').text(data.approvedCount);
                $('#count-completed').text(data.completedCount);
                $('#count-cancelled').text(data.cancelledCount);
                renderRecentAppointments(data.recentAppointments || []);
                renderRecentPatients(data.recentPatients || []);
                renderReports(data);
            })
            .fail(function(err) {
                showMessage('error', err.responseJSON && err.responseJSON.message);
            });
    }

    function renderRecentAppointments(appointments) {
        if (!appointments.length) return renderEmpty('#recentAppointmentTableBody', 4, 'No recent appointments.');
        $('#recentAppointmentTableBody').html(appointments.map(appointment => `
            <tr>
                <td>${escapeHtml(appointment.patientId?.fullName || appointment.patientName || 'Patient')}</td>
                <td>${escapeHtml(appointment.doctorId?.fullName || 'Doctor')}</td>
                <td>${escapeHtml(appointment.appointmentDate)}<br><small>${escapeHtml(appointment.appointmentTime)}</small></td>
                <td>${statusBadge(appointment.status)}</td>
            </tr>
        `).join(''));
    }

    function renderRecentPatients(patients) {
        if (!patients.length) return renderEmpty('#recentPatientTableBody', 3, 'No patients yet.');
        $('#recentPatientTableBody').html(patients.map(patient => `
            <tr>
                <td>${escapeHtml(patient.fullName)}</td>
                <td>${escapeHtml(patient.email)}</td>
                <td>${escapeHtml(patient.phone || 'N/A')}</td>
            </tr>
        `).join(''));
    }

    function loadPatients() {
        return apiRequest('/api/admin/patients')
            .done(function(patients) {
                state.patients = patients;
                renderPatients();
            })
            .fail(err => showMessage('error', err.responseJSON && err.responseJSON.message));
    }

    function renderPatients() {
        const patients = filterRows(state.patients, $('#patientSearch').val(), ['fullName', 'email', 'phone', 'bloodGroup']);
        if (!patients.length) return renderEmpty('#patientTableBody', 7, 'No matching patients.');
        $('#patientTableBody').html(patients.map(patient => `
            <tr>
                <td>${escapeHtml(patient.fullName)}</td>
                <td>${escapeHtml(patient.email)}</td>
                <td>${escapeHtml(patient.phone || 'N/A')}</td>
                <td>${escapeHtml(patient.age || 'N/A')}</td>
                <td>${escapeHtml(patient.gender || 'N/A')}</td>
                <td>${escapeHtml(patient.bloodGroup || 'N/A')}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button type="button" class="btn btn-outline-primary" data-edit="patient" data-id="${patient._id}">Edit</button>
                        <button type="button" class="btn btn-outline-danger" data-delete="patient" data-id="${patient._id}">Delete</button>
                    </div>
                </td>
            </tr>
        `).join(''));
    }

    function loadDoctors() {
        return apiRequest('/api/admin/doctors')
            .done(function(doctors) {
                state.doctors = doctors;
                renderDoctors();
                fillDoctorFilter();
            })
            .fail(err => showMessage('error', err.responseJSON && err.responseJSON.message));
    }

    function renderDoctors() {
        const doctors = filterRows(state.doctors, $('#doctorSearch').val(), ['fullName', 'email', 'phone', 'specialization', 'department']);
        if (!doctors.length) return renderEmpty('#doctorTableBody', 8, 'No matching doctors.');
        $('#doctorTableBody').html(doctors.map(doctor => `
            <tr>
                <td>${escapeHtml(doctor.fullName)}</td>
                <td>${escapeHtml(doctor.email)}</td>
                <td>${escapeHtml(doctor.phone || 'N/A')}</td>
                <td>${escapeHtml(doctor.specialization || 'General')}</td>
                <td>${escapeHtml(doctor.department || 'N/A')}</td>
                <td>${escapeHtml(doctor.availability || 'N/A')}</td>
                <td>${statusBadge(doctor.status || 'active')}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button type="button" class="btn btn-outline-primary" data-edit="doctor" data-id="${doctor._id}">Edit</button>
                        <button type="button" class="btn btn-outline-danger" data-delete="doctor" data-id="${doctor._id}">Delete</button>
                    </div>
                </td>
            </tr>
        `).join(''));
    }

    function loadStaff() {
        return apiRequest('/api/admin/staff')
            .done(function(staff) {
                state.staff = staff;
                renderStaff();
            })
            .fail(err => showMessage('error', err.responseJSON && err.responseJSON.message));
    }

    function renderStaff() {
        const staff = filterRows(state.staff, $('#staffSearch').val(), ['fullName', 'email', 'phone', 'position', 'department', 'shift']);
        if (!staff.length) return renderEmpty('#staffTableBody', 8, 'No matching staff.');
        $('#staffTableBody').html(staff.map(member => `
            <tr>
                <td>${escapeHtml(member.fullName)}</td>
                <td>${escapeHtml(member.email)}</td>
                <td>${escapeHtml(member.phone || 'N/A')}</td>
                <td>${escapeHtml(member.position || 'N/A')}</td>
                <td>${escapeHtml(member.department || 'N/A')}</td>
                <td>${escapeHtml(member.shift || 'N/A')}</td>
                <td>${statusBadge(member.status || 'active')}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button type="button" class="btn btn-outline-primary" data-edit="staff" data-id="${member._id}">Edit</button>
                        <button type="button" class="btn btn-outline-danger" data-delete="staff" data-id="${member._id}">Delete</button>
                    </div>
                </td>
            </tr>
        `).join(''));
    }

    function loadAppointments() {
        return apiRequest('/api/admin/appointments')
            .done(function(appointments) {
                state.appointments = appointments;
                renderAppointments();
            })
            .fail(err => showMessage('error', err.responseJSON && err.responseJSON.message));
    }

    function renderAppointments() {
        const status = $('#appointmentStatusFilter').val();
        const doctorId = $('#appointmentDoctorFilter').val();
        const appointments = state.appointments.filter(appointment => {
            const matchesStatus = !status || appointment.status === status;
            const matchesDoctor = !doctorId || appointment.doctorId?._id === doctorId;
            return matchesStatus && matchesDoctor;
        });

        if (!appointments.length) return renderEmpty('#appointmentTableBody', 6, 'No matching appointments.');

        $('#appointmentTableBody').html(appointments.map(appointment => `
            <tr>
                <td><strong>${escapeHtml(appointment.patientId?.fullName || appointment.patientName || 'Patient')}</strong><br><small>${escapeHtml(appointment.patientEmail || appointment.patientId?.email || '')}</small></td>
                <td>${escapeHtml(appointment.doctorId?.fullName || 'Doctor')}</td>
                <td>${escapeHtml(appointment.appointmentDate)}<br><small>${escapeHtml(appointment.appointmentTime)}</small></td>
                <td>${escapeHtml(appointment.reason || 'N/A')}</td>
                <td>${statusBadge(appointment.status)}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button type="button" class="btn btn-outline-primary" data-status="${appointment._id}" data-value="approved">Approve</button>
                        <button type="button" class="btn btn-outline-success" data-status="${appointment._id}" data-value="completed">Complete</button>
                        <button type="button" class="btn btn-outline-warning" data-status="${appointment._id}" data-value="cancelled">Cancel</button>
                        <button type="button" class="btn btn-outline-danger" data-delete-appointment="${appointment._id}">Delete</button>
                    </div>
                </td>
            </tr>
        `).join(''));
    }

    function loadUsers() {
        return apiRequest('/api/admin/users')
            .done(function(users) {
                state.users = users;
                renderUsers();
            })
            .fail(err => showMessage('error', err.responseJSON && err.responseJSON.message));
    }

    function renderUsers() {
        if (!state.users.length) return renderEmpty('#userTableBody', 4, 'No users found.');
        $('#userTableBody').html(state.users.map(user => `
            <tr>
                <td>${escapeHtml(user.name)}</td>
                <td>${escapeHtml(user.email)}</td>
                <td>
                    <select class="form-select form-select-sm role-select" data-user-id="${user._id}">
                        ${['admin', 'doctor', 'staff', 'patient'].map(item => `<option value="${item}" ${user.role === item ? 'selected' : ''}>${item}</option>`).join('')}
                    </select>
                </td>
                <td><button class="btn btn-sm btn-outline-primary" data-save-role="${user._id}">Save Role</button></td>
            </tr>
        `).join(''));
    }

    function renderReports(stats) {
        const cards = [
            ['Pending Appointments', stats.pendingCount || 0, 'Waiting for approval'],
            ['Approved Appointments', stats.approvedCount || 0, 'Confirmed visits'],
            ['Completed Appointments', stats.completedCount || 0, 'Finished care sessions'],
            ['Cancelled Appointments', stats.cancelledCount || 0, 'Did not proceed']
        ];

        $('#reportCards').html(cards.map(card => `
            <article class="report-card">
                <span>${card[0]}</span>
                <strong>${card[1]}</strong>
                <small>${card[2]}</small>
            </article>
        `).join(''));
    }

    const fieldSets = {
        patient: [
            ['fullName', 'Full Name', 'text', true],
            ['email', 'Email', 'email', true],
            ['phone', 'Phone', 'text'],
            ['age', 'Age', 'number'],
            ['gender', 'Gender', 'select', false, ['Male', 'Female', 'Other']],
            ['bloodGroup', 'Blood Group', 'text'],
            ['address', 'Address', 'textarea'],
            ['medicalHistory', 'Medical History', 'textarea']
        ],
        doctor: [
            ['fullName', 'Full Name', 'text', true],
            ['email', 'Email', 'email', true],
            ['phone', 'Phone', 'text'],
            ['specialization', 'Specialization', 'text'],
            ['department', 'Department', 'text'],
            ['availability', 'Availability', 'text'],
            ['status', 'Status', 'select', false, ['active', 'inactive']]
        ],
        staff: [
            ['fullName', 'Full Name', 'text', true],
            ['email', 'Email', 'email', true],
            ['phone', 'Phone', 'text'],
            ['position', 'Position', 'text'],
            ['department', 'Department', 'text'],
            ['shift', 'Shift', 'text'],
            ['status', 'Status', 'select', false, ['active', 'inactive']]
        ]
    };

    function findRecord(type, id) {
        const key = type === 'staff' ? 'staff' : `${type}s`;
        return state[key].find(item => item._id === id) || {};
    }

    function openRecordModal(type, id) {
        const record = id ? findRecord(type, id) : {};
        $('#recordType').val(type);
        $('#recordId').val(id || '');
        $('#recordModalTitle').text(`${id ? 'Edit' : 'Add'} ${type.charAt(0).toUpperCase() + type.slice(1)}`);

        $('#recordFields').html(fieldSets[type].map(field => {
            const [name, label, inputType, required, options] = field;
            const value = record[name] || '';
            if (inputType === 'textarea') {
                return `<div class="col-md-12"><label class="form-label">${label}</label><textarea class="form-control" name="${name}" rows="2">${escapeHtml(value)}</textarea></div>`;
            }
            if (inputType === 'select') {
                return `<div class="col-md-6"><label class="form-label">${label}</label><select class="form-select" name="${name}">${options.map(option => `<option value="${option}" ${value === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>`;
            }
            return `<div class="col-md-6"><label class="form-label">${label}</label><input class="form-control" name="${name}" type="${inputType}" value="${escapeHtml(value)}" ${required ? 'required' : ''}></div>`;
        }).join(''));

        modal.show();
    }

    function formDataToObject(form) {
        const data = {};
        $(form).serializeArray().forEach(item => {
            data[item.name] = item.value;
        });
        return data;
    }

    function saveRecord(data) {
        const type = $('#recordType').val();
        const id = $('#recordId').val();
        const routeName = type === 'staff' ? 'staff' : `${type}s`;
        const url = id ? `/api/admin/${routeName}/${id}` : `/api/admin/${routeName}`;
        const method = id ? 'PUT' : 'POST';

        apiRequest(url, { method, data })
            .done(function() {
                modal.hide();
                showMessage('success', `${type} saved successfully.`);
                refreshCurrentSection();
                loadStats();
            })
            .fail(err => showMessage('error', err.responseJSON && err.responseJSON.message));
    }

    function deleteRecord(type, id) {
        if (!confirm(`Delete this ${type}? This cannot be undone.`)) return;
        const routeName = type === 'staff' ? 'staff' : `${type}s`;
        apiRequest(`/api/admin/${routeName}/${id}`, { method: 'DELETE' })
            .done(function() {
                showMessage('success', `${type} deleted.`);
                refreshCurrentSection();
                loadStats();
            })
            .fail(err => showMessage('error', err.responseJSON && err.responseJSON.message));
    }

    function updateAppointmentStatus(id, status) {
        apiRequest(`/api/admin/appointments/${id}/status`, { method: 'PATCH', data: { status } })
            .done(function() {
                showMessage('success', 'Appointment updated.');
                loadAppointments();
                loadStats();
            })
            .fail(err => showMessage('error', err.responseJSON && err.responseJSON.message));
    }

    function deleteAppointment(id) {
        if (!confirm('Delete this appointment? This cannot be undone.')) return;
        apiRequest(`/api/admin/appointments/${id}`, { method: 'DELETE' })
            .done(function() {
                showMessage('success', 'Appointment deleted.');
                loadAppointments();
                loadStats();
            })
            .fail(err => showMessage('error', err.responseJSON && err.responseJSON.message));
    }

    function updateUserRole(userId) {
        const selectedRole = $(`.role-select[data-user-id="${userId}"]`).val();
        apiRequest(`/api/admin/users/${userId}/role`, { method: 'PATCH', data: { role: selectedRole } })
            .done(function() {
                showMessage('success', 'User role updated.');
                loadUsers();
            })
            .fail(err => {
                showMessage('error', err.responseJSON && err.responseJSON.message);
                loadUsers();
            });
    }

    function refreshCurrentSection() {
        const current = $('.admin-section:not(.d-none)').attr('id') || 'dashboard-section';
        const section = current.replace('-section', '');
        if (section === 'patients') return loadPatients();
        if (section === 'doctors') return loadDoctors();
        if (section === 'staff') return loadStaff();
        if (section === 'appointments') return loadAppointments();
        if (section === 'users') return loadUsers();
        return loadStats();
    }

    window.showSection = function(section) {
        $('.admin-section').addClass('d-none');
        $(`#${section}-section`).removeClass('d-none');
        $('[data-section-link]').removeClass('active');
        $(`[data-section-link="${section}"]`).addClass('active');

        if (section === 'dashboard') loadStats();
        if (section === 'patients') loadPatients();
        if (section === 'doctors') loadDoctors();
        if (section === 'staff') loadStaff();
        if (section === 'appointments') {
            $.when(loadDoctors()).always(loadAppointments);
        }
        if (section === 'users') loadUsers();
        if (section === 'reports') loadStats();
    };

    $('[data-section-link]').on('click', function(e) {
        e.preventDefault();
        window.showSection($(this).data('section-link'));
    });

    $('[data-open-modal]').on('click', function() {
        openRecordModal($(this).data('open-modal'));
    });

    $('#recordForm').on('submit', function(e) {
        e.preventDefault();
        saveRecord(formDataToObject(this));
    });

    $(document).on('click', '[data-edit]', function() {
        openRecordModal($(this).data('edit'), $(this).data('id'));
    });

    $(document).on('click', '[data-delete]', function() {
        deleteRecord($(this).data('delete'), $(this).data('id'));
    });

    $(document).on('click', '[data-status]', function() {
        updateAppointmentStatus($(this).data('status'), $(this).data('value'));
    });

    $(document).on('click', '[data-delete-appointment]', function() {
        deleteAppointment($(this).data('delete-appointment'));
    });

    $(document).on('click', '[data-save-role]', function() {
        updateUserRole($(this).data('save-role'));
    });

    $('#patientSearch').on('input', renderPatients);
    $('#doctorSearch').on('input', renderDoctors);
    $('#staffSearch').on('input', renderStaff);
    $('#appointmentStatusFilter, #appointmentDoctorFilter').on('change', renderAppointments);
    $('#refreshAppointments').on('click', loadAppointments);

    loadStats();
});
