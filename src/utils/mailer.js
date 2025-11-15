// src/utils/mailer.js
const nodemailer = require("nodemailer");

// Transporter (SMTP)
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT || 587),
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

/**
 * Generic email sender
 */
async function sendMail({ to, subject, html }) {
  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || "FlexiDesk <no-reply@flexidesk.com>",
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error("Email send error:", err);
    return false;
  }
}

/**
 * Format dates
 */
function fmt(d) {
  try {
    return new Date(d).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

/**
 * Booking confirmation email
 */
async function sendBookingConfirmationEmail({ to, user, booking, listing }) {
  const fullName =
    user?.name ||
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
    "Guest";

  const checkIn = fmt(booking.startDate);
  const checkOut = fmt(booking.endDate);

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 16px;">
      <h2>Hi ${fullName}, your booking is confirmed! 🎉</h2>

      <p>Thank you for booking with <b>FlexiDesk</b>.</p>

      <h3>Your Booking Details</h3>
      <ul>
        <li><b>Space:</b> ${listing?.venue || listing?.title}</li>
        <li><b>Location:</b> ${listing?.address || listing.city}</li>
        <li><b>Check-in:</b> ${checkIn} at ${booking.checkInTime}</li>
        <li><b>Check-out:</b> ${checkOut} at ${booking.checkOutTime}</li>
        <li><b>Total Hours:</b> ${booking.totalHours || "—"}</li>
        <li><b>Status:</b> Paid</li>
      </ul>

      <h3>Your QR Code</h3>
      <p>
        Your QR code for entry will be generated and sent
        <b>one day before your check-in date</b>.
      </p>

      <p style="margin-top: 24px;">
        Thank you for choosing FlexiDesk!
        <br/>If you have questions, simply reply to this email.
      </p>
    </div>
  `;

  return sendMail({
    to,
    subject: "Your FlexiDesk Booking is Confirmed",
    html,
  });
}

/**
 * Email to send QR token (the day before check-in)
 */
async function sendQrCodeEmail({ to, user, booking, qrUrl }) {
  const fullName =
    user?.name ||
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
    "Guest";

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 16px;">
      <h2>Your FlexiDesk QR Code is Ready</h2>

      <p>Hi ${fullName},</p>

      <p>Your QR code for your booking is now available. Please present this QR code upon entry.</p>

      <p style="margin-top: 20px;">
        <a href="${qrUrl}" 
           style="background:#000; color:#fff; padding:10px 16px; text-decoration:none; border-radius:6px;">
          View QR Code
        </a>
      </p>

      <p style="margin-top: 20px; color:#555;">
        If you did not request this, please contact our support team.
      </p>
    </div>
  `;

  return sendMail({
    to,
    subject: "Your FlexiDesk QR Code",
    html,
  });
}

module.exports = {
  sendMail,
  sendBookingConfirmationEmail,
  sendQrCodeEmail,
};
