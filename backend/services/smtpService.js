const net = require('net');

/**
 * Basic in-house SMTP sender using raw sockets.
 * Note: This requires the host to allow outbound connections on port 25/587.
 * Hostinger shared hosting might block this.
 */
class SMTPService {
    constructor() {
        this.host = process.env.SMTP_HOST; // e.g. mail.yourdomain.com
        this.port = process.env.SMTP_PORT || 587;
        this.user = process.env.SMTP_USER;
        this.pass = process.env.SMTP_PASS;
    }

    async sendEmail(to, subject, body) {
        return new Promise((resolve, reject) => {
            const socket = net.createConnection(this.port, this.host);
            socket.setEncoding('utf-8');

            let step = 0;

            socket.on('data', (data) => {
                console.log('SMTP Data:', data);
                if (data.startsWith('220') && step === 0) {
                    socket.write(`EHLO ${this.host}\r\n`);
                    step++;
                } else if (data.startsWith('250') && step === 1) {
                    socket.write(`AUTH LOGIN\r\n`);
                    step++;
                } else if (data.startsWith('334') && step === 2) {
                    socket.write(`${Buffer.from(this.user).toString('base64')}\r\n`);
                    step++;
                } else if (data.startsWith('334') && step === 3) {
                    socket.write(`${Buffer.from(this.pass).toString('base64')}\r\n`);
                    step++;
                } else if (data.startsWith('235') && step === 4) {
                    socket.write(`MAIL FROM:<${this.user}>\r\n`);
                    step++;
                } else if (data.startsWith('250') && step === 5) {
                    socket.write(`RCPT TO:<${to}>\r\n`);
                    step++;
                } else if (data.startsWith('250') && step === 6) {
                    socket.write(`DATA\r\n`);
                    step++;
                } else if (data.startsWith('354') && step === 7) {
                    socket.write(`Subject: ${subject}\r\n\r\n${body}\r\n.\r\n`);
                    step++;
                } else if (data.startsWith('250') && step === 8) {
                    socket.write(`QUIT\r\n`);
                    resolve(true);
                }
            });

            socket.on('error', (err) => {
                console.error('SMTP Socket Error:', err);
                reject(err);
            });
        });
    }
}

module.exports = new SMTPService();
