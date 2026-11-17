const jwt = require('jsonwebtoken');
const { pool } = require('../db');

// The password every fresh database is seeded with. It is public, so an admin
// still using it is made to replace it before doing anything else.
const DEFAULT_ADMIN_PASSWORD = 'admin123';

function signToken(user, { mustChangePassword = false } = {}) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      ...(mustChangePassword ? { mustChangePassword: true } : {}),
    },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '7d' }
  );
}

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url || null,
    role: row.role,
    createdAt: row.created_at,
  };
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    const [rows] = await pool.query(
      'SELECT id, email, display_name, avatar_url, role, created_at FROM users WHERE id = ? LIMIT 1',
      [payload.id]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = publicUser(rows[0]);
    if (payload.mustChangePassword) {
      req.user.mustChangePassword = true;
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Signed in with the seeded password: only the password change is allowed.
function requirePasswordChanged(req, res, next) {
  if (req.user?.mustChangePassword && req.path !== '/change-password') {
    return res.status(403).json({
      error: 'Set a new admin password in Settings before using the dashboard.',
      code: 'PASSWORD_CHANGE_REQUIRED',
    });
  }
  next();
}

async function optionalAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      next();
      return;
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    const [rows] = await pool.query(
      'SELECT id, email, display_name, avatar_url, role, created_at FROM users WHERE id = ? LIMIT 1',
      [payload.id]
    );

    if (rows.length) {
      req.user = publicUser(rows[0]);
    }
  } catch {
    // Ignore invalid tokens for optional auth.
  }
  next();
}

module.exports = {
  DEFAULT_ADMIN_PASSWORD,
  signToken,
  publicUser,
  requireAuth,
  requireAdmin,
  requirePasswordChanged,
  optionalAuth,
};
