require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const eventsRoutes = require('./routes/events');
const stripsRoutes = require('./routes/strips');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const { uploadsDir } = require('./utils/upload');
const { photoKey } = require('./utils/photoCipher');
const { startAutoCloseTimer } = require('./utils/eventSchedule');

const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.RAILWAY_ENVIRONMENT);

if (isProduction && !process.env.JWT_SECRET) {
  console.error('JWT_SECRET must be set in production.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 4000;
const clientBuildDir = path.join(__dirname, '..', '..', 'build');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
photoKey();

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (process.env.RAILWAY_PUBLIC_DOMAIN) {
  allowedOrigins.push(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
}

function isSameOrigin(origin, req) {
  try {
    return new URL(origin).host === req.get('host');
  } catch {
    return false;
  }
}

app.set('trust proxy', 1);

app.use(
  cors((req, callback) => {
    const origin = req.get('origin');
    if (!origin || allowedOrigins.includes(origin) || isSameOrigin(origin, req)) {
      callback(null, { origin: true, credentials: true });
      return;
    }
    callback(new Error('Not allowed by CORS'));
  })
);
app.use(express.json({ limit: '15mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/strips', stripsRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

if (fs.existsSync(path.join(clientBuildDir, 'index.html'))) {
  app.use(express.static(clientBuildDir, { index: false, maxAge: '1h' }));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientBuildDir, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'Image must be 12 MB or smaller' });
    return;
  }
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Server error' });
});

app.listen(PORT, () => {
  console.log(`Photobothus API listening on port ${PORT}`);
});

// Closes events at their scheduled end time even when nobody has them open.
startAutoCloseTimer();
