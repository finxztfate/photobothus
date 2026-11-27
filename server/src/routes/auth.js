const bcrypt = require('bcryptjs');
const express = require('express');
const { pool } = require('../db');
const { DEFAULT_ADMIN_PASSWORD, signToken, publicUser, requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const googleIdentity = require('../utils/googleIdentity');

const router = express.Router();

// Read on each request rather than once at start-up, so it follows the environment.
function isLiveSite() {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.RAILWAY_ENVIRONMENT);
}

// Auth endpoints are brute-force targets. Cap failed attempts per IP.
// Successful requests do not consume the budget.
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.AUTH_LOGIN_RATE_MAX || 5),
  countOnlyFailures: true,
  message: 'Too many failed login attempts. Please try again in a minute.',
});

const googleAuthLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.AUTH_GOOGLE_RATE_MAX || 10),
  countOnlyFailures: true,
  message: 'Too many Google sign-in attempts. Please try again in a minute.',
});

async function findUserByEmail(email) {
  const [rows] = await pool.query(
    `SELECT id, email, password_hash, google_id, display_name, avatar_url, role, created_at
     FROM users WHERE email = ? LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

async function findUserByGoogleId(googleId) {
  const [rows] = await pool.query(
    `SELECT id, email, password_hash, google_id, display_name, avatar_url, role, created_at
     FROM users WHERE google_id = ? LIMIT 1`,
    [googleId]
  );
  return rows[0] || null;
}

router.post('/google', googleAuthLimiter, async (req, res) => {
  try {
    const credential = String(req.body.credential || '').trim();
    const mode = String(req.body.mode || 'login').trim().toLowerCase();
    const acceptTerms = req.body.acceptTerms === true || req.body.acceptTerms === 'true';
    if (!credential) {
      return res.status(400).json({ error: 'Google credential is required' });
    }
    if (mode !== 'login' && mode !== 'signup') {
      return res.status(400).json({ error: 'Google mode must be login or signup' });
    }
    if (mode === 'signup' && !acceptTerms) {
      return res.status(400).json({
        error: 'Please agree to the Terms of Use and Privacy Policy to create an account.',
      });
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: 'GOOGLE_CLIENT_ID is not configured on the server' });
    }

    const payload = await googleIdentity.verifyGoogleIdToken(credential);
    if (!payload?.email || !payload.sub) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    const email = payload.email.toLowerCase();
    const googleId = payload.sub;
    const displayName = payload.name || email.split('@')[0];
    const avatarUrl = payload.picture || null;

    let user = await findUserByGoogleId(googleId);
    if (!user) {
      user = await findUserByEmail(email);
    }

    if (user?.role === 'admin') {
      return res.status(403).json({ error: 'Admin accounts must use password login' });
    }

    if (mode === 'login') {
      if (!user) {
        return res.status(404).json({
          error: 'No Photobothus account for this Google account. Sign up first.',
        });
      }
      if (!user.google_id) {
        await pool.query(
          'UPDATE users SET google_id = ?, display_name = COALESCE(display_name, ?), avatar_url = ? WHERE id = ?',
          [googleId, displayName, avatarUrl, user.id]
        );
        user = await findUserByGoogleId(googleId);
      }
    } else {
      if (user) {
        return res.status(409).json({
          error: 'This Google account already has a Photobothus account. Log in instead.',
        });
      }
      const [result] = await pool.query(
        `INSERT INTO users (email, password_hash, google_id, display_name, avatar_url, role)
         VALUES (?, NULL, ?, ?, ?, 'customer')`,
        [email, googleId, displayName, avatarUrl]
      );
      user = {
        id: result.insertId,
        email,
        display_name: displayName,
        avatar_url: avatarUrl,
        role: 'customer',
        created_at: new Date(),
      };
    }

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: 'Google sign-in failed' });
  }
});

router.post('/register', async (_req, res) => {
  res.status(400).json({
    error: 'Email signup is disabled. Please sign up with Google.',
  });
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const [rows] = await pool.query(
      'SELECT id, email, password_hash, display_name, avatar_url, role, created_at FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (!rows.length || !rows[0].password_hash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const row = rows[0];
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // The seeded admin password is public. A live site refuses it; elsewhere it
    // signs in to a session that can do nothing except set a new password.
    const usingDefaultPassword = row.role === 'admin' && password === DEFAULT_ADMIN_PASSWORD;
    if (usingDefaultPassword && isLiveSite()) {
      return res.status(403).json({
        error:
          'The default admin password is disabled on a live site. Set ADMIN_PASSWORD and run "npm run db:init" to replace it.',
      });
    }

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [row.id]);

    if (usingDefaultPassword) {
      return res.json({
        token: signToken(row, { mustChangePassword: true }),
        user: { ...publicUser(row), mustChangePassword: true },
      });
    }

    const token = signToken(row);
    res.json({ token, user: publicUser(row) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
