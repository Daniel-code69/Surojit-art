const nodemailer = require('nodemailer');
const { config } = require('../config');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });
  return transporter;
}

async function sendWelcomeEmail(studentEmail, studentName) {
  try {
    const t = getTransporter();
    await t.sendMail({
      from: config.email.from,
      to: studentEmail,
      subject: 'Welcome to Sarojit Pal Art! 🎨',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4F46E5;">Welcome to Sarojit Pal Art!</h1>
          <p>Hello ${studentName},</p>
          <p>Thank you for joining Sarojit Pal Art! You now have access to premium art courses taught by industry professionals.</p>
          <p>Here's what you can do:</p>
          <ul>
            <li>Browse our course catalog and enroll in courses</li>
            <li>Access high-quality video lessons</li>
            <li>Join private Telegram channels for each course</li>
            <li>Connect with fellow artists</li>
          </ul>
          <p>
            <a href="https://sarojitpalart.com/courses.html"
               style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Browse Courses
            </a>
          </p>
          <p>Happy creating!<br/>The Sarojit Pal Art Team</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Failed to send welcome email:', err);
  }
}

async function sendPurchaseConfirmation(studentEmail, studentName, courseName, amount, receiptId, telegramLink, studentId) {
  try {
    const t = getTransporter();
    const botUsername = config.telegram.botUsername;
    const tLink = telegramLink || `https://t.me/${botUsername}?start=verify_${studentId}`;
    await t.sendMail({
      from: config.email.from,
      to: studentEmail,
      subject: `You're enrolled in ${courseName}! 🎉`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4F46E5;">Enrollment Confirmed!</h1>
          <p>Hello ${studentName},</p>
          <p>You are now enrolled in <strong>${courseName}</strong>.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Course</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${courseName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Amount Paid</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">₹${amount}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Receipt</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${receiptId}</td>
            </tr>
          </table>

          <h2>How to access your course content</h2>
          <p><strong>Step 1:</strong> Click the button below to connect your Telegram account.</p>
          <p>
            <a href="${tLink}"
               style="background-color: #0088cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Connect Telegram
            </a>
          </p>
          <p><strong>Step 2:</strong> After connecting, you'll receive an invite link to the private course channel.</p>
          <p><strong>Step 3:</strong> Access all video lessons on our website through your student dashboard.</p>

          <p>
            <a href="https://sarojitpalart.com/student-dashboard.html"
               style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Go to Dashboard
            </a>
          </p>
          <p>If you have any questions, reply to this email or contact us on Telegram.</p>
          <p>Happy creating!<br/>The Sarojit Pal Art Team</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Failed to send purchase confirmation email:', err);
  }
}

module.exports = { sendWelcomeEmail, sendPurchaseConfirmation };
