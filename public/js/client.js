$(document).ready(function() {
    const today = new Date().toISOString().split('T')[0];
    $('#quickDate, #bookingDate').attr('min', today);

    function showBookingAlert(type, message) {
        $('#bookingAlert')
            .removeClass('d-none alert-success alert-danger')
            .addClass(`alert-${type}`)
            .text(message);
    }

    function fillDoctorSelects(doctors) {
        const options = doctors.map(doctor => (
            `<option value="${doctor._id}" data-department="${doctor.department || ''}">${doctor.fullName} - ${doctor.specialization || 'General'}</option>`
        )).join('');

        $('#quickDoctor, #bookingDoctor').append(options);
    }

    $.get('/api/public/doctors', fillDoctorSelects);

    $('[data-book-appointment]').on('click', function(e) {
        e.preventDefault();
        document.getElementById('appointmentForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
        $('#bookingName').trigger('focus');
    });

    $('#quickBookingForm').on('submit', function(e) {
        e.preventDefault();
        $('#bookingDoctor').val($('#quickDoctor').val());
        $('#bookingDate').val($('#quickDate').val());
        $('#bookingTime').val($('#quickTime').val());
        document.getElementById('appointmentForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
        $('#bookingName').trigger('focus');
    });

    $('#appointmentForm').on('submit', function(e) {
        e.preventDefault();

        const booking = {
            fullName: $('#bookingName').val(),
            email: $('#bookingEmail').val(),
            phone: $('#bookingPhone').val(),
            doctorId: $('#bookingDoctor').val(),
            appointmentDate: $('#bookingDate').val(),
            appointmentTime: $('#bookingTime').val(),
            reason: $('#bookingReason').val()
        };

        $.ajax({
            url: '/api/public/appointments',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(booking),
            success: function(response) {
                showBookingAlert('success', response.message);
                $('#appointmentForm')[0].reset();
            },
            error: function(err) {
                showBookingAlert('danger', err.responseJSON && err.responseJSON.message ? err.responseJSON.message : 'Could not book appointment.');
            }
        });
    });
});
