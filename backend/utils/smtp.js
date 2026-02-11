/**
 * Send email via in-house SMTP (using net.Socket)
 * This is a basic SMTP client implementation for sending OTP emails
 * without relying on external services like SendGrid or Nodemailer
 * 
 * NOTE: This is a placeholder implementation. Configure your SMTP server details below.
 */
const sendEmail = async (to, subject, body) => {
    // PLACEHOLDER: Configure your SMTP server
    // For now, just log the email (in production, configure real SMTP)
    console.log(`[SMTP Mock] Sending email to: ${to}`);
    console.log(`[SMTP Mock] Subject: ${subject}`);
    console.log(`[SMTP Mock] Body: ${body}`);

    // Simulate successful send
    return Promise.resolve({ success: true });

    /* UNCOMMENT AND CONFIGURE FOR REAL SMTP:
    return new Promise((resolve, reject) => {
        const client = net.createConnection({ port: 587, host: 'smtp.yourdomain.com' }, () => {
            console.log('Connected to SMTP server');
        });

        let step = 0;

        client.on('data', (data) => {
            const response = data.toString();
            console.log('SMTP Response:', response);

            try {
                if (step === 0 && response.startsWith('220')) {
                    client.write('EHLO localhost\r\n');
                    step++;
                } else if (step === 1 && response.startsWith('250')) {
                    client.write('MAIL FROM:<noreply@yourdomain.com>\r\n');
                    step++;
                } else if (step === 2 && response.startsWith('250')) {
                    client.write(`RCPT TO:<${to}>\r\n`);
                    step++;
                } else if (step === 3 && response.startsWith('250')) {
                    client.write('DATA\r\n');
                    step++;
                } else if (step === 4 && response.startsWith('354')) {
                    const emailContent = `From: noreply@yourdomain.com\r\nTo: ${to}\r\nSubject: ${subject}\r\n\r\n${body}\r\n.\r\n`;
                    client.write(emailContent);
                    step++;
                } else if (step === 5 && response.startsWith('250')) {
                    client.write('QUIT\r\n');
                    resolve({ success: true });
                }
            } catch (err) {
                reject(err);
            }
        });

        client.on('error', (err) => {
            console.error('SMTP Error:', err);
            reject(err);
        });

        client.on('end', () => {
            console.log('SMTP connection closed');
        });
    });
    */
};

/**
 * Generate a 6-digit OTP
 */
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

module.exports = { sendEmail, generateOTP };
