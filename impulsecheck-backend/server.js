const express  = require('express');
const cors     = require('cors');
const passport = require('passport');
const session  = require('express-session');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt      = require('jsonwebtoken');
const db       = require('./config/db');
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

/* ── SESSION (needed for passport OAuth flow only) ── */
app.use(session({
  secret: process.env.JWT_SECRET || 'impulsecheck-session-secret',
  resave: false,
  saveUninitialized: false,
}));

/* ── PASSPORT ── */
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:  'https://impulsecheck-backend.onrender.com/auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email     = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
    if (!email) return done(new Error('No email returned from Google'), null);
    const full_name = profile.displayName;
    const google_id = profile.id;

    // Check if user exists
    const existing = await db.query(
      'SELECT id, full_name, email, currency FROM users WHERE email = $1',
      [email]
    );

    let user;
    if (existing.rows.length > 0) {
      user = existing.rows[0];
    } else {
      // Create new user (no password needed for Google users)
      const result = await db.query(
        `INSERT INTO users (full_name, username, email, password_hash, is_verified, currency)
         VALUES ($1, $2, $3, $4, true, 'PHP')
         RETURNING id, full_name, email, currency`,
        [full_name, email.split('@')[0], email, 'GOOGLE_OAUTH_' + google_id]
      );
      user = result.rows[0];

      // Create preferences + welcome notification
      await db.query('INSERT INTO user_preferences (user_id) VALUES ($1)', [user.id]);
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)`,
        [user.id, '🎉 Welcome to ImpulseCheck!', 'Your account is ready. Start by setting your monthly budget.', 'welcome']
      );
    }

    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));

/* ── GOOGLE AUTH ROUTES ── */
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: 'https://cozy-bienenstitch-7eef5a.netlify.app/login.html?error=google_failed' }),
  (req, res) => {
    const user  = req.user;
    const token = jwt.sign(
      { id: user.id, email: user.email, full_name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    // Redirect to frontend with token + user info
    const params = new URLSearchParams({
      token,
      id:        user.id,
      full_name: user.full_name,
      email:     user.email,
      currency:  user.currency || 'PHP',
    });
    res.redirect(`https://cozy-bienenstitch-7eef5a.netlify.app/oauth-callback.html?${params}`);
  }
);

/* ── API ROUTES ── */
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/budget',        require('./routes/budget'));
app.use('/api/ai',            require('./routes/ai'));
app.use('/api/purchases',     require('./routes/purchases'));
app.use('/api/profile',       require('./routes/profile'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/report',        require('./routes/report'));

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
