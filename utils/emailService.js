const net = require('net');
const tls = require('tls');

const readLine = (socket) => new Promise((resolve, reject) => {
    let buffer = '';
    const onData = (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/).filter(Boolean);
        if (!lines.length) return;
        const last = lines[lines.length - 1];
        if (/^\d{3}\s/.test(last)) {
            socket.off('data', onData);
            socket.off('error', reject);
            resolve(buffer);
        }
    };
    socket.on('data', onData);
    socket.once('error', reject);
});

const sendCommand = async (socket, command, hidden = false) => {
    if (!hidden) console.log(`SMTP > ${command}`);
    socket.write(`${command}\r\n`);
    return readLine(socket);
};

const assertSmtp = (response, expected) => {
    const code = Number(String(response).slice(0, 3));
    const allowed = Array.isArray(expected) ? expected : [expected];
    if (!allowed.includes(code)) {
        throw new Error(`SMTP error ${String(response).trim()}`);
    }
};

const getSocket = () => new Promise((resolve, reject) => {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const socket = secure
        ? tls.connect(port, host, { servername: host }, () => resolve(socket))
        : net.connect(port, host, () => resolve(socket));

    socket.once('error', reject);
});

const encodeAddress = (address) => `<${address}>`;

const sendMail = async ({ to, subject, text }) => {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log(`Email not sent to ${to}. Configure SMTP_HOST, SMTP_USER, and SMTP_PASS to enable mail delivery.`);
        console.log(`Subject: ${subject}`);
        console.log(text);
        return { sent: false, status: 'smtp_not_configured' };
    }

    let socket = await getSocket();
    try {
        assertSmtp(await readLine(socket), 220);
        assertSmtp(await sendCommand(socket, `EHLO ${process.env.SMTP_FROM_NAME || 'medilife.local'}`), 250);

        const port = Number(process.env.SMTP_PORT || 587);
        const secure = process.env.SMTP_SECURE === 'true' || port === 465;
        if (!secure) {
            assertSmtp(await sendCommand(socket, 'STARTTLS'), 220);
            socket = tls.connect({ socket, servername: process.env.SMTP_HOST });
            assertSmtp(await sendCommand(socket, `EHLO ${process.env.SMTP_FROM_NAME || 'medilife.local'}`), 250);
        }

        assertSmtp(await sendCommand(socket, 'AUTH LOGIN'), 334);
        assertSmtp(await sendCommand(socket, Buffer.from(process.env.SMTP_USER).toString('base64'), true), 334);
        assertSmtp(await sendCommand(socket, Buffer.from(process.env.SMTP_PASS).toString('base64'), true), 235);

        const from = process.env.SMTP_FROM || process.env.SMTP_USER;
        assertSmtp(await sendCommand(socket, `MAIL FROM:${encodeAddress(from)}`), 250);
        assertSmtp(await sendCommand(socket, `RCPT TO:${encodeAddress(to)}`), [250, 251]);
        assertSmtp(await sendCommand(socket, 'DATA'), 354);

        const body = [
            `From: ${process.env.SMTP_FROM_NAME || 'MEDILIFE'} <${from}>`,
            `To: ${to}`,
            `Subject: ${subject}`,
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=utf-8',
            '',
            text.replace(/\r?\n\./g, '\n..'),
            '.'
        ].join('\r\n');
        socket.write(`${body}\r\n`);
        assertSmtp(await readLine(socket), 250);
        await sendCommand(socket, 'QUIT');
        return { sent: true, status: 'sent' };
    } finally {
        socket.end();
    }
};

const sendAppointmentEmail = async ({ to, name, doctorName, appointmentDate, appointmentTime, status }) => {
    const friendlyStatus = status === 'approved' ? 'confirmed' : status;
    return sendMail({
        to,
        subject: `MEDILIFE appointment ${friendlyStatus}`,
        text: [
            `Hello ${name},`,
            '',
            `Your appointment with ${doctorName} is ${friendlyStatus}.`,
            `Date: ${appointmentDate}`,
            `Time: ${appointmentTime}`,
            '',
            'Thank you,',
            'MEDILIFE'
        ].join('\n')
    });
};

module.exports = { sendAppointmentEmail };
