const express = require('express');
const cors    = require('cors');
require('dotenv').config();

// Polyfill fetch for Node.js versions below 18
if (!globalThis.fetch) {
  globalThis.fetch = require('node-fetch');
}

require('./config/db');

const app = express();

app.use(cors({
  origin: '*',
  credentials: false,
}));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

/* ── ROUTES ── */
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
