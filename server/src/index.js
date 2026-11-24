require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const authRoutes = require('./routes/auth');
const eventsRoutes = require('./routes/events');
const stripsRoutes = require('./routes/strips');
const publicRoutes = require('./routes/public');
const spotlightRoutes = require('./routes/spotlight');
const ticketsRoutes = require('./routes/tickets');
const adminRoutes = require('./routes/admin');
const { uploadsDir } = require('./utils/upload');
const { photoKey } = require('./utils/photoCipher');
const { startAutoCloseTimer } = require('./utils/eventSchedule');
const { pool, isPoolBusyError } = require('./db');
const { concurrencyGate } = require('./utils/concurrency');

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

function readPositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

app.set('trust proxy', 1);

app.use(
  helmet({
    // The SPA and encrypted image endpoints are same-origin; keep defaults
    // that do not break inline CRA styles or the camera booth.
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());

app.post('/api/tickets/webhook', express.raw({ type: 'application/json' }), ticketsRoutes.handlePolarWebhook);

app.use(
  cors((req, callback) => {
    const origin = req.get('origin');
    if (!origin || allowedOrigins.includes(origin) || isSameOrigin(origin, req)) {
      callback(null, { origin: true, credentials: true });
      return;
    }
    // Reject quietly; throwing here looks like a 500 from the error handler.
    callback(null, { origin: false });
  })
);

// Auth/settings JSON is small; large payloads belong on multipart upload routes.
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Cap in-flight API work so a traffic spike returns 503 instead of melting the process.
// Health checks stay outside this gate so the platform can keep monitoring.
const apiConcurrency = concurrencyGate(readPositiveInt(process.env.API_MAX_CONCURRENT, 100));
app.use('/api', (req, res, next) => {
  if (req.path === '/health') {
    next();
    return;
  }
  apiConcurrency(req, res, next);
});

app.use('/api/auth', authRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/strips', stripsRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/spotlight', spotlightRoutes);
app.use('/api/tickets', ticketsRoutes);
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
  if (err.status === 503 || err.code === 'SERVER_BUSY' || isPoolBusyError(err)) {
    res.set('Retry-After', '5');
    res.status(503).json({ error: err.message || 'Server is busy. Please try again in a moment.' });
    return;
  }
  if (err.type === 'entity.too.large') {
    res.status(413).json({ error: 'Request body is too large' });
    return;
  }
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Server error' });
});

const server = app.listen(PORT, () => {
  console.log(`Photobothus API listening on port ${PORT}`);
});

// Bound how long a single request can hold a connection open.
server.requestTimeout = readPositiveInt(process.env.REQUEST_TIMEOUT_MS, 120_000);
server.headersTimeout = readPositiveInt(process.env.HEADERS_TIMEOUT_MS, 65_000);
server.keepAliveTimeout = readPositiveInt(process.env.KEEP_ALIVE_TIMEOUT_MS, 65_000);
server.timeout = readPositiveInt(process.env.SOCKET_TIMEOUT_MS, 120_000);

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}, shutting down…`);

  server.close(async () => {
    try {
      await pool.end();
    } catch (err) {
      console.error(err);
    }
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, readPositiveInt(process.env.SHUTDOWN_TIMEOUT_MS, 10_000)).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

// Closes events at their scheduled end time even when nobody has them open.
startAutoCloseTimer();
