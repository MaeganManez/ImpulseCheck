// mailer.js — ImpulseCheck
// Uses Brevo HTTP API (not SMTP — works on Render)

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL    = 'manezmaegan06@gmail.com';
const FROM_NAME     = 'ImpulseCheck';

// Map DB currency codes to symbols
const CURRENCY_SYMBOLS = {
  'PHP': '₱',
  'USD': '$',
  'EUR': '€',
  'GBP': '£',
};

async function brevoSend(payload) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': BREVO_API_KEY,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('[mailer] Brevo error:', data);
    throw new Error(data.message || 'Failed to send email');
  }
  return data;
}

async function sendOTPEmail(toEmail, otp, type) {
  type = type || 'register';
  const subject  = type === 'register' ? 'ImpulseCheck - Verify Your Account' : 'ImpulseCheck - Password Reset OTP';
  const heading  = type === 'register' ? 'Verify Your Account' : 'Reset Your Password';
  const bodyText = type === 'register' ? 'Thank you for signing up!' : 'Reset your password using the OTP below.';

  await brevoSend({
    sender:      { name: FROM_NAME, email: FROM_EMAIL },
    to:          [{ email: toEmail }],
    subject,
    htmlContent: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;">
      <h1 style="color:#1a4a5c;">ImpulseCheck</h1>
      <h2>${heading}</h2>
      <p>${bodyText}</p>
      <div style="background:#e6f5f0;border:2px solid #2eaa7e;border-radius:12px;padding:20px;text-align:center;">
        <p style="font-size:12px;margin:0 0 8px;">YOUR OTP CODE</p>
        <p style="color:#2eaa7e;font-size:36px;font-weight:800;letter-spacing:10px;margin:0;">${otp}</p>
      </div>
      <p style="font-size:12px;text-align:center;margin-top:16px;">This OTP expires in 10 minutes.</p>
    </div>`,
  });
  console.log(`[mailer] OTP sent to ${toEmail}`);
}

async function sendReportEmail(toEmail, userName, reportData, period) {
  const sym  = CURRENCY_SYMBOLS[reportData.currency] || '₱';

  const rows = reportData.purchases.length > 0
    ? reportData.purchases.map(p =>
        `<tr>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;">${p.item_name}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;">${p.category || '—'}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;">${sym}${Number(p.price).toLocaleString()}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:center;">${p.user_decision}</td>
        </tr>`
      ).join('')
    : `<tr><td colspan="4" style="padding:20px;text-align:center;color:#999;">No purchases recorded for this period.</td></tr>`;

  await brevoSend({
    sender:      { name: FROM_NAME, email: FROM_EMAIL },
    to:          [{ email: toEmail }],
    subject:     `ImpulseCheck - Your ${period} Spending Report`,
    htmlContent: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;">
      <h1 style="color:#1a4a5c;margin-bottom:4px;">ImpulseCheck</h1>
      <p style="color:#718096;font-size:13px;margin-top:0;">AI-Powered Spending Intervention</p>
      <h2 style="margin-top:24px;">Hi ${userName}, here is your ${period} spending report!</h2>
      <div style="background:#e6f5f0;border-radius:10px;padding:16px 20px;margin:20px 0;">
        <p style="margin:0;font-size:15px;color:#2d3748;">
          Total Spent: <strong style="color:#2eaa7e;">${sym}${Number(reportData.totalSpent).toLocaleString()}</strong>
        </p>
        ${reportData.impulsiveCount > 0 ? `<p style="margin:6px 0 0;font-size:13px;color:#718096;">
          ${reportData.impulsiveCount} impulsive purchase(s) — ${sym}${Number(reportData.impulsiveAmount).toLocaleString()} total
        </p>` : ''}
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="background:#2eaa7e;color:#fff;">
          <th style="padding:10px 8px;text-align:left;">Item</th>
          <th style="padding:10px 8px;text-align:left;">Category</th>
          <th style="padding:10px 8px;text-align:right;">Price</th>
          <th style="padding:10px 8px;text-align:center;">Decision</th>
        </tr>
        ${rows}
      </table>
      <p style="font-size:12px;color:#a0aec0;margin-top:24px;text-align:center;">
        Stay mindful of your spending. — ImpulseCheck
      </p>
    </div>`,
  });
  console.log(`[mailer] Report sent to ${toEmail}`);
}

module.exports = { sendOTPEmail, sendReportEmail };