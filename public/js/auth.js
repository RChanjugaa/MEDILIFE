$(document).ready(function() {
    const API_URL = '/api/auth';

    function getDashboardPath(role) {
        const dashboards = {
            admin: 'admin-dashboard.html',
            doctor: 'doctor-dashboard.html',
            patient: 'patient-dashboard.html',
            staff: 'staff-dashboard.html'
        };
        return dashboards[role] || 'patient-dashboard.html';
    }

    function saveSession(response) {
        localStorage.setItem('token', response.token);
        localStorage.setItem('role', response.role);
        localStorage.setItem('userName', response.name);
        localStorage.setItem('userId', response._id);
    }

    function showAuthError(message) {
        $('#authAlert')
            .removeClass('d-none alert-success')
            .addClass('alert-danger')
            .text(message || 'Something went wrong. Please try again.');
    }

    function setSubmitLoading(formSelector, isLoading) {
        const button = $(`${formSelector} button[type="submit"]`);
        button.prop('disabled', isLoading);
        button.text(isLoading ? 'Please wait...' : button.data('label'));
    }

    $('#loginForm button[type="submit"], #registerForm button[type="submit"]').each(function() {
        $(this).data('label', $(this).text());
    });

    window.handleGoogleCredential = function(response) {
        $.ajax({
            url: `${API_URL}/google`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ credential: response.credential }),
            success: function(user) {
                saveSession(user);
                window.location.href = getDashboardPath(user.role);
            },
            error: function(err) {
                showAuthError(err.responseJSON && err.responseJSON.message);
            }
        });
    };

    function initializeGoogleLogin() {
        if (!$('#googleSignIn').length) return;

        $.get(`${API_URL}/config`, function(config) {
            if (!config.googleClientId) {
                $('#googleSignInHelp').removeClass('d-none');
                return;
            }

            const waitForGoogle = setInterval(function() {
                if (!window.google || !window.google.accounts) return;
                clearInterval(waitForGoogle);
                google.accounts.id.initialize({
                    client_id: config.googleClientId,
                    callback: window.handleGoogleCredential
                });
                google.accounts.id.renderButton(
                    document.getElementById('googleSignIn'),
                    { theme: 'outline', size: 'large', width: 360 }
                );
            }, 150);
        });
    }

    // Handle Login
    $('#loginForm').on('submit', function(e) {
        e.preventDefault();
        setSubmitLoading('#loginForm', true);
        const data = {
            email: $('#email').val(),
            password: $('#password').val()
        };

        $.ajax({
            url: `${API_URL}/login`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function(response) {
                saveSession(response);
                window.location.href = getDashboardPath(response.role);
            },
            error: function(err) {
                showAuthError(err.responseJSON && err.responseJSON.message);
                setSubmitLoading('#loginForm', false);
            }
        });
    });

    // Handle Registration
    $('#registerForm').on('submit', function(e) {
        e.preventDefault();
        setSubmitLoading('#registerForm', true);
        const password = $('#password').val();
        const confirmPassword = $('#confirmPassword').val();

        if (password !== confirmPassword) {
            showAuthError('Passwords do not match.');
            setSubmitLoading('#registerForm', false);
            return;
        }

        const data = {
            name: $('#name').val(),
            email: $('#email').val(),
            password,
            role: $('#role').val()
        };

        $.ajax({
            url: `${API_URL}/register`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function(response) {
                saveSession(response);
                window.location.href = getDashboardPath(response.role);
            },
            error: function(err) {
                showAuthError(err.responseJSON && err.responseJSON.message);
                setSubmitLoading('#registerForm', false);
            }
        });
    });

    // Logout function
    window.logout = function() {
        localStorage.clear();
        window.location.href = 'login.html';
    };

    initializeGoogleLogin();
});
