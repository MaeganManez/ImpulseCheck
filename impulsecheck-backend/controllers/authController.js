const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const db       = require('../config/db');
const { sendOTPEmail } = require('../config/mailer');
require('dotenv').config();

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/;

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
}

async function register(req, res) {
  try {
    const { full_name, username, email, phone_number, age, date_of_birth, password } = req.body;

    if (!full_name || !username || !email || !password) {
      return res.status(400).json({ error: 'Full name, username, email, and password are required.' });
    }

    if (!PASSWORD_REGEX.test(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character (!@#$%^&*).'
      });
    }

    // ── Check duplicate email — allow re-registration if unverified ──
    const [emailCheck] = await db.query('SELECT id, is_verified FROM users WHERE email = ?', [email]);
    if (emailCheck.length > 0) {
      if (emailCheck[0].is_verified) {
        return res.status(409).json({ error: 'Email is already registered.' });
      }
      // Delete unverified account so they can re-register
      await db.query('DELETE FROM users WHERE id = ?', [emailCheck[0].id]);
    }

    // ── Check duplicate username — allow re-registration if unverified ──
    const [usernameCheck] = await db.query('SELECT id, is_verified FROM users WHERE username = ?', [username]);
    if (usernameCheck.length > 0) {
      if (usernameCheck[0].is_verified) {
        return res.status(409).json({ error: 'Username is already taken. Please choose a different one.' });
      }
      await db.query('DELETE FROM users WHERE id = ?', [usernameCheck[0].id]);
    }

    const salt          = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const [result] = await db.query(
      `INSERT INTO users
        (full_name, username, email, phone_number, age, date_of_birth, password_hash, is_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [full_name, username, email, phone_number || null, age || null, date_of_birth || null, password_hash]
    );

    const userId = result.insertId;

    await db.query('INSERT INTO user_preferences (user_id) VALUES (?)', [userId]);

    const otp       = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.query(
      'INSERT INTO otp_verifications (user_id, otp_code, type, expires_at) VALUES (?, ?, ?, ?)',
      [userId, otp, 'register', expiresAt]
    );

    try {
      await sendOTPEmail(email, otp, 'register');
    } catch (mailErr) {
      console.warn('Email send failed (continuing):', mailErr.message);
    }

    return res.status(201).json({
      message: `Account created. OTP sent to ${email}. Please verify to continue.`,
      user_id: userId,
      email,
    });

  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
}

async function verifyOTP(req, res) {
  try {
    const { user_id, otp_code } = req.body;

    if (!user_id || !otp_code) {
      return res.status(400).json({ error: 'User ID and OTP code are required.' });
    }

    const [rows] = await db.query(
      `SELECT * FROM otp_verifications
       WHERE user_id = ? AND otp_code = ? AND type = 'register'
         AND used = 0 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [user_id, otp_code]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP. Please request a new one.' });
    }

    await db.query('UPDATE otp_verifications SET used = 1 WHERE id = ?', [rows[0].id]);
    await db.query('UPDATE users SET is_verified = 1 WHERE id = ?', [user_id]);

    const [userRows] = await db.query(
      'SELECT id, full_name, email, currency FROM users WHERE id = ?',
      [user_id]
    );
    const user  = userRows[0];
    const token = generateToken({ id: user.id, email: user.email, full_name: user.full_name });

    await db.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES (?, ?, ?, ?)`,
      [user.id, '🎉 Welcome to ImpulseCheck!', 'Your account is verified. Start by setting your monthly budget.', 'welcome']
    );

    return res.status(200).json({
      message: 'Account verified successfully!',
      token,
      user: { id: user.id, full_name: user.full_name, email: user.email, currency: user.currency },
    });

  } catch (err) {
    console.error('VerifyOTP error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}

async function resendOTP(req, res) {
  try {
    const { user_id } = req.body;

    const [userRows] = await db.query('SELECT id, email, is_verified FROM users WHERE id = ?', [user_id]);
    if (userRows.length === 0) return res.status(404).json({ error: 'User not found.' });
    if (userRows[0].is_verified) return res.status(400).json({ error: 'Account is already verified.' });

    const otp       = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.query(
      'INSERT INTO otp_verifications (user_id, otp_code, type, expires_at) VALUES (?, ?, ?, ?)',
      [user_id, otp, 'register', expiresAt]
    );

    try {
      await sendOTPEmail(userRows[0].email, otp, 'register');
    } catch (mailErr) {
      console.warn('Email send failed (continuing):', mailErr.message);
    }

    return res.status(200).json({ message: 'New OTP sent to your email.' });

  } catch (err) {
    console.error('ResendOTP error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const [rows] = await db.query(
      'SELECT id, full_name, username, email, password_hash, currency, is_verified FROM users WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = rows[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.is_verified) {
      return res.status(403).json({
        error: 'Account not verified. Please check your email for the OTP.',
        user_id: user.id,
        needs_verification: true,
      });
    }

    const token = generateToken({ id: user.id, email: user.email, full_name: user.full_name });

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: { id: user.id, full_name: user.full_name, username: user.username, email: user.email, currency: user.currency },
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const [rows] = await db.query('SELECT id, email FROM users WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.status(200).json({ message: 'If that email exists, an OTP has been sent.' });
    }

    const user      = rows[0];
    const otp       = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.query(
      'INSERT INTO otp_verifications (user_id, otp_code, type, expires_at) VALUES (?, ?, ?, ?)',
      [user.id, otp, 'forgot_password', expiresAt]
    );

    try {
      await sendOTPEmail(email, otp, 'forgot_password');
    } catch (mailErr) {
      console.warn('Email send failed (continuing):', mailErr.message);
    }

    return res.status(200).json({
      message: 'OTP sent to your email.',
      user_id: user.id,
    });

  } catch (err) {
    console.error('ForgotPassword error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}

async function resetPassword(req, res) {
  try {
    const { user_id, otp_code, new_password } = req.body;

    if (!user_id || !otp_code || !new_password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    if (!PASSWORD_REGEX.test(new_password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
      });
    }

    const [rows] = await db.query(
      `SELECT * FROM otp_verifications
       WHERE user_id = ? AND otp_code = ? AND type = 'forgot_password'
         AND used = 0 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [user_id, otp_code]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    await db.query('UPDATE otp_verifications SET used = 1 WHERE id = ?', [rows[0].id]);

    const salt          = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(new_password, salt);

    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, user_id]);

    return res.status(200).json({ message: 'Password reset successfully. You can now log in.' });

  } catch (err) {
    console.error('ResetPassword error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}

async function getMe(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.full_name, u.username, u.email, u.phone_number,
              u.age, u.date_of_birth, u.avatar_url, u.currency,
              p.preselect_emotion, p.default_emotion
       FROM users u
       LEFT JOIN user_preferences p ON p.user_id = u.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });

    return res.status(200).json({ user: rows[0] });

  } catch (err) {
    console.error('GetMe error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}

module.exports = { register, verifyOTP, resendOTP, login, forgotPassword, resetPassword, getMe };