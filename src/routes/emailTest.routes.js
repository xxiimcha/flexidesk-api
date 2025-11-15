const express = require("express");
const router = express.Router();
const { sendMail } = require("../utils/mailer");

router.get("/test-email", async (req, res) => {
  try {
    const to = "charmaine.l.d.cator@gmail.com";

    await sendMail({
      to,
      subject: "FlexiDesk Test Email",
      html: `
        <div style="font-family: Arial; padding: 16px;">
          <h2>FlexiDesk Test Email 🎉</h2>
          <p>This is a test email sent automatically to:</p>
          <p><b>${to}</b></p>
          <p>If you received this, your email configuration works correctly.</p>
        </div>
      `,
    });

    return res.json({
      ok: true,
      message: `Test email sent to ${to}`,
    });
  } catch (err) {
    console.error("TEST EMAIL ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to send test email",
      error: err?.message,
    });
  }
});

module.exports = router;
