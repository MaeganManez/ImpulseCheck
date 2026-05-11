require('dotenv').config();

async function sendOTPEmail(toEmail, otp, type) {
  type = type || 'register';
  const subject = type === 'register' ? 'ImpulseCheck - Verify Your Account' : 'ImpulseCheck - Password Reset OTP';
  const heading = type === 'register' ? 'Verify Your Account' : 'Reset Your Password';
  const bodyText = type === 'register' ? 'Thank you for signing up! Use the OTP below to verify your account.' : 'We received a request to reset your password. Use the OTP below.';

  const response = await fetch('https://api.mailersend.com/v1/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MAILERSEND_API_KEY}`
    },
    body: JSON.stringify({
      from: { email: 'MS_test@trial-3z0vkloj1on4dpyo.mlsender.net', name: 'ImpulseCheck' },
      to: [{ email: toEmail }],
      subject: subject,
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;">
        <h1 style="color:#1a4a5c;">ImpulseCheck</h1>
        <h2 style="color:#2d3748;">${heading}</h2>
        <p style="color:#718096;">${bodyText}</p>
        <div style="background:#e6f5f0;border:2px solid #2eaa7e;border-radius:12px;padding:20px;text-align:center;">
          <p style="color:#718096;font-size:12px;margin:0 0 8px;">YOUR OTP CODE</p>
          <p style="color:#2eaa7e;font-size:36px;font-weight:800;letter-spacing:10px;margin:0;">${otp}</p>
        </div>
        <p style="color:#a0aec0;font-size:12px;text-align:center;margin-top:16px;">This OTP expires in 10 minutes.</p>
      </div>`
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(JSON.stringify(err));
  }
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

  const response = await fetch('https://api.mailersend.com/v1/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MAILERSEND_API_KEY}`
    },
    body: JSON.stringify({
      from: { email: 'MS_test@trial-3z0vkloj1on4dpyo.mlsender.net', name: 'ImpulseCheck' },
      to: [{ email: toEmail }],
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
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(JSON.stringify(err));
  }
}

module.exports = { sendOTPEmail, sendReportEmail };