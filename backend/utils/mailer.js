const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail', // Use a real service or mock service like Ethereal
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendConfirmationEmail = async (to, eventDetails) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: to,
        subject: `Registration Confirmed: ${eventDetails.title}`,
        text: `You have successfully registered for ${eventDetails.title}.\nLocation: ${eventDetails.location_name}\nDate: ${new Date(eventDetails.date).toLocaleString()}\n\nSee you there!`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Confirmation email sent to ${to}`);
    } catch (error) {
        console.error(`Error sending email to ${to}:`, error);
    }
};

module.exports = { sendConfirmationEmail };
