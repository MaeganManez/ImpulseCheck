const express = require('express');
const cors    = require('cors');
const jwt     = require('jsonwebtoken');
const db      = require('./config/db');
require('dotenv').config();

if (!globalThis.fetch) {
  globalThis.fetch = require('node-fetch');
}

require('./config/db');

const app = express();

app.use(cors({ origin: '*', credentials: false }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

/* ── SUPABASE GOOGLE AUTH ── */
app.post('/api/auth/google-supabase', async (req, res) => {
  try {
    const { access_token } = req.body;
    if (!access_token) return res.status(400).json({ error: 'Missing access_token.' });

    // Verify token with Supabase and get user info
    const supaRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    });

    if (!supaRes.ok) return res.status(401).json({ error: 'Invalid Supabase token.' });

    const supaUser = await supaRes.json();
    const email     = supaUser.email;
    const full_name = supaUser.user_metadata?.full_name || supaUser.user_metadata?.name || email.split('@')[0];
    const google_id = supaUser.id;

    if (!email) return res.status(400).json({ error: 'No email from Supabase.' });

    // Upsert user in your own DB
    const [existingRows] = await db.query(
      'SELECT id, full_name, email, currency FROM users WHERE email = $1',
      [email]
    );

    let user;
    if (existingRows.length > 0) {
      user = existingRows[0];
    } else {
      const [newRows] = await db.query(
        `INSERT INTO users (full_name, username, email, password_hash, is_verified, currency)
         VALUES ($1, $2, $3, $4, 1, 'PHP')
         RETURNING id, full_name, email, currency`,
        [full_name, email.split('@')[0], email, 'SUPABASE_GOOGLE_' + google_id]
      );
      user = newRows[0];

      await db.query('INSERT INTO user_preferences (user_id) VALUES ($1)', [user.id]);
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)`,
        [user.id, '🎉 Welcome to ImpulseCheck!', 'Your account is ready. Start by setting your monthly budget.', 'welcome']
      );
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, full_name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({ token, user });
  } catch (err) {
    console.error('Supabase Google auth error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/* ── API ROUTES ── */
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/budget',        require('./routes/budget'));
app.use('/api/ai',            require('./routes/ai'));
app.use('/api/purchases',     require('./routes/purchases'));
app.use('/api/profile',       require('./routes/profile'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/report',        require('./routes/report'));
app.use('/api/qrauth',        require('./routes/qrauth'));

/* ── HEALTH CHECK ── */
app.get('/', (req, res) => res.json({ status: 'running', app: 'ImpulseCheck API', version: '2.0.0' }));

/* ── 404 ── */
app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` }));

/* ── ERROR ── */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 ImpulseCheck API running at http://localhost:${PORT}`);
});
