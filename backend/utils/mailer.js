const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter;

const setupTransporter = async () => {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_PASS !== 'your_app_password') {
        console.log('Using configured Gmail service.');
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    } else {
        console.log('No valid email credentials found. Creating Ethereal Test Account...');
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });
        console.log(`Ethereal Test Account Created. User: ${testAccount.user}`);
    }
};

const sendConfirmationEmail = async (to, eventDetails) => {
    if (!transporter) await setupTransporter();

    const mailOptions = {
        from: process.env.EMAIL_USER || 'noreply@supika.com',
        to: to,
        subject: `Registration Confirmed: ${eventDetails.title}`,
        text: `You have successfully registered for ${eventDetails.title}.\nLocation: ${eventDetails.location_name}\nDate: ${new Date(eventDetails.date).toLocaleString()}\n\nSee you there!`
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`Confirmation email sent: ${info.messageId}`);
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) console.log(`Preview URL: ${previewUrl}`);
    } catch (error) {
        console.error(`Error sending email to ${to}:`, error);
    }
};

const sendPasswordResetEmail = async (to, resetToken) => {
    if (!transporter) await setupTransporter();

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    const mailOptions = {
        from: process.env.EMAIL_USER || 'noreply@supika.com',
        to: to,
        subject: 'Password Reset Request',
        html: `
            <p>You requested a password reset. Click the link below to reset your password:</p>
            <a href="${resetUrl}">${resetUrl}</a>
            <p>If you did not request this, please ignore this email.</p>
            <p>This link will expire in 1 hour.</p>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`Password reset email sent: ${info.messageId}`);
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
            console.log(`\n-----------------------------------------`);
            console.log(`| PASSWORD RESET EMAIL (MOCK)          |`);
            console.log(`| Preview URL: ${previewUrl} `);
            console.log(`-----------------------------------------\n`);
        }
    } catch (error) {
        console.error(`Error sending reset email to ${to}:`, error);
    }
};

module.exports = { sendConfirmationEmail, sendPasswordResetEmail };
