const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const QRCode  = require('qrcode');
const jwt     = require('jsonwebtoken');
const db      = require('../config/db');

// In-memory store for QR sessions { [sessionId]: { status, userId, token } }
const qrSessions = {};

// Clean up expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const id in qrSessions) {
    if (qrSessions[id].expiresAt < now) delete qrSessions[id];
  }
}, 5 * 60 * 1000);

/* ── POST /api/qrauth/generate
   Desktop calls this to get a QR code image (base64) + session ID ── */
router.post('/generate', async (req, res) => {
  try {
    const sessionId = uuidv4();
    qrSessions[sessionId] = {
      status:    'pending',
      userId:    null,
      token:     null,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 min expiry
    };

    const approveUrl =
      `https://cozy-bienenstitch-7eef5a.netlify.app/qr-approve.html?session=${sessionId}`;

    const qrDataUrl = await QRCode.toDataURL(approveUrl, {
      width: 220,
      margin: 2,
      color: { dark: '#1a4a5c', light: '#ffffff' },
    });

    return res.json({ sessionId, qrDataUrl });
  } catch (err) {
    console.error('QR generate error:', err);
    return res.status(500).json({ error: 'Failed to generate QR code.' });
  }
});

/* ── POST /api/qrauth/approve
   Phone calls this after scanning — must be logged in ── */
router.post('/approve', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Not authenticated.' });

    const tokenStr = authHeader.replace('Bearer ', '');
    let decoded;
    try {
      decoded = jwt.verify(tokenStr, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    const session = qrSessions[sessionId];
    if (!session)               return res.status(404).json({ error: 'QR session not found or expired.' });
    if (session.status !== 'pending') return res.status(400).json({ error: 'QR already used.' });
    if (session.expiresAt < Date.now()) {
      delete qrSessions[sessionId];
      return res.status(410).json({ error: 'QR code expired.' });
    }

    // Fetch full user from DB
    const [rows] = await db.query(
      'SELECT id, full_name, email, currency FROM users WHERE id = $1',
      [decoded.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    const user = rows[0];

    // Issue new JWT for desktop
    const newToken = jwt.sign(
      { id: user.id, email: user.email, full_name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    qrSessions[sessionId] = {
      ...session,
      status: 'approved',
      userId: user.id,
      token:  newToken,
      user,
    };

    return res.json({ message: 'QR login approved.' });
  } catch (err) {
    console.error('QR approve error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

/* ── GET /api/qrauth/poll/:sessionId
   Desktop polls this every 2s waiting for approval ── */
router.get('/poll/:sessionId', (req, res) => {
  const session = qrSessions[req.params.sessionId];
  if (!session) return res.json({ status: 'expired' });
  if (session.expiresAt < Date.now()) {
    delete qrSessions[req.params.sessionId];
    return res.json({ status: 'expired' });
  }
  if (session.status === 'approved') {
    const { token, user } = session;
    delete qrSessions[req.params.sessionId]; // one-time use
    return res.json({ status: 'approved', token, user });
  }
  return res.json({ status: 'pending' });
});

module.exports = router;
