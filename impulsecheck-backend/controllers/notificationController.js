const db = require('../config/db');

/* ════════════════════════════════════════
   GET /api/notifications
════════════════════════════════════════ */
async function getNotifications(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT id, title, message, type, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 30`,
      [req.user.id]
    );

    const unreadCount = rows.filter(n => !n.is_read).length;

    return res.status(200).json({ notifications: rows, unread_count: unreadCount });

  } catch (err) {
    console.error('GetNotifications error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}

/* ════════════════════════════════════════
   PUT /api/notifications/read-all
════════════════════════════════════════ */
async function markAllRead(req, res) {
  try {
    await db.query(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
      [req.user.id]
    );
    return res.status(200).json({ message: 'All notifications marked as read.' });
  } catch (err) {
    console.error('MarkAllRead error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}

/* ════════════════════════════════════════
   PUT /api/notifications/:id/read
════════════════════════════════════════ */
async function markOneRead(req, res) {
  try {
    await db.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    return res.status(200).json({ message: 'Notification marked as read.' });
  } catch (err) {
    console.error('MarkOneRead error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}

/* ════════════════════════════════════════
   Helper: Create a notification
   Used internally by other controllers
════════════════════════════════════════ */
async function createNotification(userId, title, message, type = 'info') {
  try {
    await db.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
      [userId, title, message, type]
    );
  } catch (err) {
    console.error('CreateNotification error:', err);
  }
}

module.exports = { getNotifications, markAllRead, markOneRead, createNotification };
