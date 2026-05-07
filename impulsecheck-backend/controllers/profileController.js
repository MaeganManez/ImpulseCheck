const db = require('../config/db');

/* ════════════════════════════════════════
   PUT /api/profile
   Update name, email, avatar, currency
════════════════════════════════════════ */
async function updateProfile(req, res) {
  try {
    const { full_name, email, currency, avatar_url } = req.body;
    const userId = req.user.id;

    if (!full_name || !email) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }

    // Check email not taken by another user
    const [existing] = await db.query(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email, userId]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email is already in use by another account.' });
    }

    await db.query(
      `UPDATE users
       SET full_name = ?, email = ?, currency = ?, avatar_url = ?
       WHERE id = ?`,
      [full_name, email, currency || 'PHP', avatar_url || null, userId]
    );

    return res.status(200).json({ message: 'Profile updated successfully.' });

  } catch (err) {
    console.error('UpdateProfile error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}

/* ════════════════════════════════════════
   PUT /api/profile/preferences
   Update display preferences
════════════════════════════════════════ */
async function updatePreferences(req, res) {
  try {
    const { currency, preselect_emotion, default_emotion } = req.body;
    const userId = req.user.id;

    await db.query(
      `INSERT INTO user_preferences (user_id, currency, preselect_emotion, default_emotion)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         currency          = VALUES(currency),
         preselect_emotion = VALUES(preselect_emotion),
         default_emotion   = VALUES(default_emotion)`,
      [userId, currency || 'PHP', preselect_emotion ? 1 : 0, default_emotion || null]
    );

    // Also update currency on users table
    await db.query(
      'UPDATE users SET currency = ? WHERE id = ?',
      [currency || 'PHP', userId]
    );

    return res.status(200).json({ message: 'Preferences saved.' });

  } catch (err) {
    console.error('UpdatePreferences error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}

module.exports = { updateProfile, updatePreferences };
