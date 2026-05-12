require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    ciphers: 'SSLv3'
  }
});

async function sendOTPEmail(toEmail, otp, type) {
  type = type || 'register';
  const subject = type === 'register' ? 'ImpulseCheck - Verify Your Account' : 'ImpulseCheck - Password Reset OTP';
  const heading = type === 'register' ? 'Verify Your Account' : 'Reset Your Password';
  const bodyText = type === 'register' ? 'Thank you for signing up!' : 'Reset your password using the OTP below.';

  await transporter.sendMail({
    from: `ImpulseCheck <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;">
      <h1 style="color:#1a4a5c;">ImpulseCheck</h1>
      <h2>${heading}</h2>
      <p>${bodyText}</p>
      <div style="background:#e6f5f0;border:2px solid #2eaa7e;border-radius:12px;padding:20px;text-align:center;">
        <p style="font-size:12px;margin:0 0 8px;">YOUR OTP CODE</p>
        <p style="color:#2eaa7e;font-size:36px;font-weight:800;letter-spacing:10px;margin:0;">${otp}</p>
      </div>
      <p style="font-size:12px;text-align:center;margin-top:16px;">This OTP expires in 10 minutes.</p>
    </div>`
  });
}

async function sendReportEmail(toEmail, userName, reportData, period) {
  const sym = reportData.currency || 'PHP ';
  const rows = reportData.purchases.map(p =>
    `<tr>
      <td style="padding:8px;">${p.item_name}</td>
      <td style="padding:8px;">${p.category}</td>
      <td style="padding:8px;text-align:right;">${sym}${Number(p.price).toLocaleString()}</td>
      <td style="padding:8px;text-align:center;">${p.user_decision}</td>
    </tr>`
  ).join('');

  await transporter.sendMail({
    from: `ImpulseCheck <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `ImpulseCheck - Your ${period} Spending Report`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;">
      <h1 style="color:#1a4a5c;">ImpulseCheck</h1>
      <h2>Hi ${userName}, here is your ${period} spending report!</h2>
      <p>Total Spent: ${sym}${Number(reportData.totalSpent).toLocaleString()}</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="background:#2eaa7e;color:#fff;">
          <th style="padding:8px;text-align:left;">Item</th>
          <th style="padding:8px;text-align:left;">Category</th>
          <th style="padding:8px;text-align:right;">Price</th>
          <th style="padding:8px;text-align:center;">Decision</th>
        </tr>
        ${rows}
      </table>
    </div>`
  });
}

module.exports = { sendOTPEmail, sendReportEmail };