const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const db      = require('../config/db');

/* ════════════════════════════════════════
   GET /api/qrauth/my-qr
   Returns a signed QR URL for the logged-in user
════════════════════════════════════════ */
router.get('/my-qr', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Not authenticated.' });

    const tokenStr = authHeader.replace('Bearer ', '');
    let decoded;
    try {
      decoded = jwt.verify(tokenStr, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    // Long-lived QR token (30 days)
    const qrToken = jwt.sign(
      { id: decoded.id, type: 'qr_login' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    const qrUrl = `${process.env.FRONTEND_URL}/login.html?qr=${qrToken}`;
    return res.json({ qrToken, qrUrl });
  } catch (err) {
    console.error('QR my-qr error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

/* ════════════════════════════════════════
   POST /api/qrauth/verify
   Verifies scanned QR token → returns full JWT
════════════════════════════════════════ */
router.post('/verify', async (req, res) => {
  try {
    const { qrToken } = req.body;
    if (!qrToken) return res.status(400).json({ error: 'QR token required.' });

    let decoded;
    try {
      decoded = jwt.verify(qrToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'QR code is invalid or expired.' });
    }

    if (decoded.type !== 'qr_login') {
      return res.status(401).json({ error: 'Invalid QR code.' });
    }

    const [rows] = await db.query(
      'SELECT id, full_name, email, currency FROM users WHERE id = $1',
      [decoded.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    const user = rows[0];

    const token = jwt.sign(
      { id: user.id, email: user.email, full_name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({ token, user });
  } catch (err) {
    console.error('QR verify error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
