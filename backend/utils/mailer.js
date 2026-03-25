const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = process.env.EMAIL_FROM || 'Supika <noreply@supika.vercel.app>';

const sendConfirmationEmail = async (to, eventDetails) => {
    if (!process.env.RESEND_API_KEY) {
        console.log('[Mailer] RESEND_API_KEY not set — skipping confirmation email');
        return;
    }
    try {
        const { data, error } = await resend.emails.send({
            from: FROM_ADDRESS,
            to,
            subject: `Registration Confirmed: ${eventDetails.title}`,
            html: `
                <h2>You're going to ${eventDetails.title}! 🎉</h2>
                <p><strong>Location:</strong> ${eventDetails.location_name}</p>
                <p><strong>Date:</strong> ${new Date(eventDetails.date).toLocaleString()}</p>
                <br>
                <p>See you there!</p>
                <p style="color:#888;font-size:12px;">— The Supika Team</p>
            `
        });
        if (error) throw error;
        console.log(`[Mailer] Confirmation email sent: ${data.id}`);
    } catch (error) {
        console.error(`[Mailer] Error sending confirmation email to ${to}:`, error);
    }
};

const sendPasswordResetEmail = async (to, resetToken) => {
    if (!process.env.RESEND_API_KEY) {
        console.log('[Mailer] RESEND_API_KEY not set — password reset link:', resetToken);
        return;
    }
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    try {
        const { data, error } = await resend.emails.send({
            from: FROM_ADDRESS,
            to,
            subject: 'Reset your Supika password',
            html: `
                <h2>Password Reset Request</h2>
                <p>Click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
                <br>
                <a href="${resetUrl}" style="background:#38bdf8;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
                    Reset Password
                </a>
                <br><br>
                <p style="font-size:12px;color:#888;">If you did not request this, you can safely ignore this email.</p>
            `
        });
        if (error) throw error;
        console.log(`[Mailer] Password reset email sent: ${data.id}`);
    } catch (error) {
        console.error(`[Mailer] Error sending reset email to ${to}:`, error);
    }
};

module.exports = { sendConfirmationEmail, sendPasswordResetEmail };
