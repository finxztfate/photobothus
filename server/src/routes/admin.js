const express = require('express');
const { pool } = require('../db');
const {
  DEFAULT_ADMIN_PASSWORD,
  signToken,
  requireAuth,
  requireAdmin,
  requirePasswordChanged,
} = require('../middleware/auth');
const { mapStripRows, deleteEventAndFiles } = require('../utils/stripHelpers');
const {
  loadAllSettings,
  setSettings,
  ensureDefaults,
  MAX_EVENT_UPLOADS_CEILING,
} = require('../utils/settings');
const {
  HOME_LIMIT,
  expireWeekPick,
  weekEndsAt,
  weekIsCurrent,
  weekStartKey,
  getSpotlightTz,
  loadAdminStandings,
} = require('../utils/spotlight');
const { parseSpotlightDetails } = require('../utils/spotlightDetails');
const { addTickets } = require('../utils/tickets');
const { rateLimit } = require('../middleware/rateLimit');
const bcrypt = require('bcryptjs');

const router = express.Router();

router.use(requireAuth, requireAdmin, requirePasswordChanged);

// Slow password guessing on the change-password form (no public reset endpoint).
const changePasswordLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.AUTH_PASSWORD_CHANGE_RATE_MAX || 5),
  countOnlyFailures: true,
  message: 'Too many password change attempts. Please try again in a minute.',
});

function settingsPayload(settings) {
  return {
    maxGuestUploads: Number(settings.max_guest_uploads),
    maxEventUploads: Number(settings.max_event_uploads),
    eventCreationEnabled: settings.event_creation_enabled !== '0' && settings.event_creation_enabled !== 'false',
    imageAccessTtlHours: Number(settings.image_access_ttl_hours),
  };
}

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

router.get('/stats', async (_req, res) => {
  try {
    const [[users]] = await pool.query('SELECT COUNT(*) AS count FROM users');
    const [[customers]] = await pool.query(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'customer'"
    );
    const [[events]] = await pool.query('SELECT COUNT(*) AS count FROM events');
    const [[activeEvents]] = await pool.query(
      'SELECT COUNT(*) AS count FROM events WHERE is_active = 1'
    );
    const [[strips]] = await pool.query('SELECT COUNT(*) AS count FROM strips');
    const [[stripsToday]] = await pool.query(
      'SELECT COUNT(*) AS count FROM strips WHERE DATE(created_at) = CURDATE()'
    );
    const [[stripsMonth]] = await pool.query(
      'SELECT COUNT(*) AS count FROM strips WHERE YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())'
    );
    const [[newCustomersWeek]] = await pool.query(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'customer' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
    );
    const [[newCustomersMonth]] = await pool.query(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'customer' AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())"
    );
    const [[eventStrips]] = await pool.query(
      'SELECT COUNT(*) AS count FROM strips WHERE event_id IS NOT NULL'
    );
    const [[personalStrips]] = await pool.query(
      'SELECT COUNT(*) AS count FROM strips WHERE event_id IS NULL'
    );

    // "Users" = photobooth / guest participants (distinct guest_key), not premium accounts
    const [[participants]] = await pool.query(
      `SELECT COUNT(DISTINCT guest_key) AS count
       FROM strips
       WHERE guest_key IS NOT NULL AND guest_key != ''`
    );
    const [[participantsToday]] = await pool.query(
      `SELECT COUNT(DISTINCT guest_key) AS count
       FROM strips
       WHERE guest_key IS NOT NULL AND guest_key != ''
         AND DATE(created_at) = CURDATE()`
    );
    const [[participantsWeek]] = await pool.query(
      `SELECT COUNT(DISTINCT guest_key) AS count
       FROM strips
       WHERE guest_key IS NOT NULL AND guest_key != ''
         AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
    );
    const [[participantsMonth]] = await pool.query(
      `SELECT COUNT(DISTINCT guest_key) AS count
       FROM strips
       WHERE guest_key IS NOT NULL AND guest_key != ''
         AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );

    async function countActiveCustomers(days) {
      const [rows] = await pool.query(
        `SELECT COUNT(DISTINCT u.id) AS count
         FROM users u
         WHERE u.role = 'customer'
           AND (
             u.last_login_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
             OR EXISTS (
               SELECT 1 FROM events e
               WHERE e.owner_id = u.id
                 AND e.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
             )
             OR EXISTS (
               SELECT 1 FROM events e
               INNER JOIN strips s ON s.event_id = e.id
               WHERE e.owner_id = u.id
                 AND s.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
             )
           )`,
        [days, days, days]
      );
      return Number(rows[0].count);
    }

    let activeCustomers7d = 0;
    let activeCustomers30d = 0;
    try {
      activeCustomers7d = await countActiveCustomers(7);
      activeCustomers30d = await countActiveCustomers(30);
    } catch (err) {
      // last_login_at may be missing on older DBs — fall back to event/strip activity only
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        const [rows7] = await pool.query(
          `SELECT COUNT(DISTINCT u.id) AS count
           FROM users u
           WHERE u.role = 'customer'
             AND (
               EXISTS (
                 SELECT 1 FROM events e
                 WHERE e.owner_id = u.id
                   AND e.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
               )
               OR EXISTS (
                 SELECT 1 FROM events e
                 INNER JOIN strips s ON s.event_id = e.id
                 WHERE e.owner_id = u.id
                   AND s.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
               )
             )`
        );
        const [rows30] = await pool.query(
          `SELECT COUNT(DISTINCT u.id) AS count
           FROM users u
           WHERE u.role = 'customer'
             AND (
               EXISTS (
                 SELECT 1 FROM events e
                 WHERE e.owner_id = u.id
                   AND e.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
               )
               OR EXISTS (
                 SELECT 1 FROM events e
                 INNER JOIN strips s ON s.event_id = e.id
                 WHERE e.owner_id = u.id
                   AND s.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
               )
             )`
        );
        activeCustomers7d = Number(rows7[0].count);
        activeCustomers30d = Number(rows30[0].count);
      } else {
        throw err;
      }
    }

    let revenueTotal = 0;
    let revenueMonth = 0;
    let revenueToday = 0;
    let paidOrders = 0;
    let pendingOrders = 0;
    let recentPayments = [];
    let revenueByType = [];
    let revenueDailyMap = {};

    try {
      const [[rt]] = await pool.query(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'paid'"
      );
      const [[rm]] = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM payments
         WHERE status = 'paid'
           AND YEAR(created_at) = YEAR(CURDATE())
           AND MONTH(created_at) = MONTH(CURDATE())`
      );
      const [[rd]] = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM payments
         WHERE status = 'paid' AND DATE(created_at) = CURDATE()`
      );
      const [[po]] = await pool.query(
        "SELECT COUNT(*) AS count FROM payments WHERE status = 'paid'"
      );
      const [[pend]] = await pool.query(
        "SELECT COUNT(*) AS count FROM payments WHERE status = 'pending'"
      );
      const [payRows] = await pool.query(
        `SELECT p.id, p.amount, p.currency, p.type, p.status, p.note, p.created_at,
                u.email AS user_email, e.name AS event_name
         FROM payments p
         LEFT JOIN users u ON u.id = p.user_id
         LEFT JOIN events e ON e.id = p.event_id
         ORDER BY p.created_at DESC
         LIMIT 8`
      );
      const [typeRows] = await pool.query(
        `SELECT type, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
         FROM payments WHERE status = 'paid'
         GROUP BY type`
      );
      const [dailyRevenue] = await pool.query(
        `SELECT DATE(created_at) AS day, COALESCE(SUM(amount), 0) AS total
         FROM payments
         WHERE status = 'paid' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
         GROUP BY DATE(created_at)
         ORDER BY day ASC`
      );
      dailyRevenue.forEach((row) => {
        const key = new Date(row.day).toISOString().slice(0, 10);
        revenueDailyMap[key] = money(row.total);
      });

      revenueTotal = money(rt.total);
      revenueMonth = money(rm.total);
      revenueToday = money(rd.total);
      paidOrders = Number(po.count);
      pendingOrders = Number(pend.count);
      recentPayments = payRows.map((row) => ({
        id: row.id,
        amount: money(row.amount),
        currency: row.currency,
        type: row.type,
        status: row.status,
        note: row.note,
        createdAt: row.created_at,
        userEmail: row.user_email,
        eventName: row.event_name,
      }));
      revenueByType = typeRows.map((row) => ({
        type: row.type,
        label: String(row.type).replace(/_/g, ' '),
        total: money(row.total),
        count: Number(row.count),
      }));
    } catch (err) {
      if (err.code !== 'ER_NO_SUCH_TABLE') throw err;
    }

    const [dailyStrips] = await pool.query(
      `SELECT DATE(created_at) AS day, COUNT(*) AS total
       FROM strips
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
       GROUP BY DATE(created_at)
       ORDER BY day ASC`
    );
    const stripsDailyMap = {};
    dailyStrips.forEach((row) => {
      const key = new Date(row.day).toISOString().slice(0, 10);
      stripsDailyMap[key] = Number(row.total);
    });

    const [dailySignups] = await pool.query(
      `SELECT DATE(created_at) AS day, COUNT(*) AS total
       FROM users
       WHERE role = 'customer' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
       GROUP BY DATE(created_at)
       ORDER BY day ASC`
    );
    const signupsDailyMap = {};
    dailySignups.forEach((row) => {
      const key = new Date(row.day).toISOString().slice(0, 10);
      signupsDailyMap[key] = Number(row.total);
    });

    const [dailyParticipants] = await pool.query(
      `SELECT DATE(created_at) AS day, COUNT(DISTINCT guest_key) AS total
       FROM strips
       WHERE guest_key IS NOT NULL AND guest_key != ''
         AND created_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
       GROUP BY DATE(created_at)
       ORDER BY day ASC`
    );
    const participantsDailyMap = {};
    dailyParticipants.forEach((row) => {
      const key = new Date(row.day).toISOString().slice(0, 10);
      participantsDailyMap[key] = Number(row.total);
    });

    const [dailyEventActivity] = await pool.query(
      `SELECT DATE(s.created_at) AS day, COUNT(DISTINCT s.event_id) AS total
       FROM strips s
       WHERE s.event_id IS NOT NULL
         AND s.created_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
       GROUP BY DATE(s.created_at)
       ORDER BY day ASC`
    );
    const eventActivityDailyMap = {};
    dailyEventActivity.forEach((row) => {
      const key = new Date(row.day).toISOString().slice(0, 10);
      eventActivityDailyMap[key] = Number(row.total);
    });

    const last14Days = [];
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      last14Days.push({
        date: key,
        label,
        revenue: revenueDailyMap[key] || 0,
        strips: stripsDailyMap[key] || 0,
        signups: signupsDailyMap[key] || 0,
        users: participantsDailyMap[key] || 0,
        liveEvents: eventActivityDailyMap[key] || 0,
      });
    }

    const [topEvents] = await pool.query(
      `SELECT e.id, e.name, e.code, e.is_active, COUNT(s.id) AS strip_count
       FROM events e
       LEFT JOIN strips s ON s.event_id = e.id
       GROUP BY e.id
       ORDER BY strip_count DESC, e.created_at DESC
       LIMIT 5`
    );

    const [topCustomers] = await pool.query(
      `SELECT u.id, u.email, u.display_name,
              COUNT(DISTINCT e.id) AS event_count,
              COUNT(s.id) AS strip_count
       FROM users u
       LEFT JOIN events e ON e.owner_id = u.id
       LEFT JOIN strips s ON s.event_id = e.id
       WHERE u.role = 'customer'
       GROUP BY u.id
       ORDER BY strip_count DESC, event_count DESC, u.created_at DESC
       LIMIT 5`
    );

    const avgStripsPerEvent =
      Number(events.count) > 0
        ? Number((Number(eventStrips.count) / Number(events.count)).toFixed(1))
        : 0;

    res.json({
      stats: {
        // Customers = premium hosts (signed-in accounts)
        accounts: Number(users.count),
        customers: Number(customers.count),
        activeCustomers7d,
        activeCustomers30d,
        newCustomersWeek: Number(newCustomersWeek.count),
        newCustomersMonth: Number(newCustomersMonth.count),
        // Users = guest / photobooth participants (distinct guest_key)
        users: Number(participants.count),
        usersToday: Number(participantsToday.count),
        activeUsers7d: Number(participantsWeek.count),
        activeUsers30d: Number(participantsMonth.count),
        events: Number(events.count),
        activeEvents: Number(activeEvents.count),
        closedEvents: Number(events.count) - Number(activeEvents.count),
        strips: Number(strips.count),
        stripsToday: Number(stripsToday.count),
        stripsMonth: Number(stripsMonth.count),
        eventStrips: Number(eventStrips.count),
        personalStrips: Number(personalStrips.count),
        avgStripsPerEvent,
        revenueTotal,
        revenueMonth,
        revenueToday,
        paidOrders,
        pendingOrders,
        currency: 'PHP',
        revenueByType,
        recentPayments,
        chart14d: last14Days,
        eventStatusChart: [
          { name: 'Active', value: Number(activeEvents.count) },
          { name: 'Closed', value: Math.max(0, Number(events.count) - Number(activeEvents.count)) },
        ],
        stripSourceChart: [
          { name: 'Event', value: Number(eventStrips.count) },
          { name: 'Personal', value: Number(personalStrips.count) },
        ],
        audienceChart: [
          { name: 'Customers', value: Number(customers.count) },
          { name: 'Users', value: Number(participants.count) },
        ],
        topEvents: topEvents.map((row) => ({
          id: row.id,
          name: row.name,
          code: row.code,
          isActive: !!row.is_active,
          stripCount: Number(row.strip_count),
        })),
        topCustomers: topCustomers.map((row) => ({
          id: row.id,
          email: row.email,
          displayName: row.display_name,
          eventCount: Number(row.event_count),
          stripCount: Number(row.strip_count),
        })),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

router.get('/payments', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, u.email AS user_email, e.name AS event_name
       FROM payments p
       LEFT JOIN users u ON u.id = p.user_id
       LEFT JOIN events e ON e.id = p.event_id
       ORDER BY p.created_at DESC
       LIMIT 100`
    );
    res.json({
      payments: rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        eventId: row.event_id,
        amount: money(row.amount),
        currency: row.currency,
        type: row.type,
        status: row.status,
        note: row.note,
        createdAt: row.created_at,
        userEmail: row.user_email,
        eventName: row.event_name,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list payments. Did you run migrate_payments.sql?' });
  }
});

router.post('/payments', async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const type = String(req.body.type || 'event_hosting');
    const status = String(req.body.status || 'paid');
    const currency = String(req.body.currency || 'PHP').toUpperCase().slice(0, 8);
    const note = String(req.body.note || '').trim() || null;
    const userId = req.body.userId ? Number(req.body.userId) : null;
    const eventId = req.body.eventId ? Number(req.body.eventId) : null;
    const tickets = req.body.tickets != null ? Number(req.body.tickets) : (type === 'event_hosting' ? 1 : 0);

    const allowedTypes = ['event_hosting', 'strip_pack', 'premium', 'other'];
    const allowedStatus = ['pending', 'paid', 'refunded', 'failed'];

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid payment type' });
    }
    if (!allowedStatus.includes(status)) {
      return res.status(400).json({ error: 'Invalid payment status' });
    }

    const [result] = await pool.query(
      `INSERT INTO payments (user_id, event_id, amount, currency, type, status, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, eventId, amount, currency, type, status, note]
    );

    const [rows] = await pool.query('SELECT * FROM payments WHERE id = ?', [result.insertId]);
    let account = null;
    if (status === 'paid' && userId && Number.isInteger(tickets) && tickets > 0) {
      account = await addTickets(userId, tickets);
    }
    res.status(201).json({
      payment: {
        id: rows[0].id,
        userId: rows[0].user_id,
        eventId: rows[0].event_id,
        amount: money(rows[0].amount),
        currency: rows[0].currency,
        type: rows[0].type,
        status: rows[0].status,
        note: rows[0].note,
        createdAt: rows[0].created_at,
      },
      tickets: account,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create payment. Did you run migrate_payments.sql?' });
  }
});

router.post('/tickets', async (req, res) => {
  try {
    const userId = Number(req.body.userId);
    const tickets = Number(req.body.tickets);
    const note = String(req.body.note || '').trim().slice(0, 255);
    if (!Number.isInteger(userId) || userId < 1) {
      return res.status(400).json({ error: 'A customer is required' });
    }
    const [users] = await pool.query(
      'SELECT id, email, display_name, avatar_url, role, created_at FROM users WHERE id = ?',
      [userId]
    );
    if (!users[0] || users[0].role !== 'customer') {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const account = await addTickets(userId, tickets);
    await pool.query(
      `INSERT INTO payments (user_id, event_id, amount, currency, type, status, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        null,
        0,
        'PHP',
        'event_hosting',
        'paid',
        note || `Granted ${tickets} event ticket${tickets === 1 ? '' : 's'}`,
      ]
    );
    res.status(201).json({ userId, ...account });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to grant tickets' });
  }
});

router.get('/users', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, email, display_name, role, event_tickets, potw_wins, created_at
       FROM users
       WHERE role = 'customer'
       ORDER BY created_at DESC`
    );
    res.json({
      users: rows.map((row) => ({
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        role: row.role,
        tickets: Number(row.event_tickets || 0),
        potwWins: Number(row.potw_wins || 0),
        createdAt: row.created_at,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list customers' });
  }
});

router.get('/events', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT e.id, e.owner_id, e.name, e.code, e.is_active, e.created_at,
              u.email AS owner_email, COUNT(s.id) AS strip_count
       FROM events e
       LEFT JOIN users u ON u.id = e.owner_id
       LEFT JOIN strips s ON s.event_id = e.id
       GROUP BY e.id
       ORDER BY e.created_at DESC`
    );
    res.json({
      events: rows.map((row) => ({
        id: row.id,
        ownerId: row.owner_id,
        ownerEmail: row.owner_email,
        name: row.name,
        code: row.code,
        isActive: !!row.is_active,
        createdAt: row.created_at,
        stripCount: Number(row.strip_count),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list events' });
  }
});

router.delete('/events/:id', async (req, res) => {
  try {
    const deleted = await deleteEventAndFiles(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

router.get('/settings', async (_req, res) => {
  try {
    await ensureDefaults();
    const settings = await loadAllSettings();
    res.json({ settings: settingsPayload(settings) });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Failed to load settings. Did you run migrate_app_settings.sql?',
    });
  }
});

router.patch('/settings', async (req, res) => {
  try {
    await ensureDefaults();
    const updates = {};

    if (req.body.maxGuestUploads != null) {
      const n = Number(req.body.maxGuestUploads);
      if (!Number.isFinite(n) || n < 1 || n > 100) {
        return res.status(400).json({ error: 'Guest upload limit must be between 1 and 100' });
      }
      updates.max_guest_uploads = String(Math.floor(n));
    }

    if (req.body.maxEventUploads != null) {
      const n = Number(req.body.maxEventUploads);
      if (!Number.isFinite(n) || n < 1 || n > MAX_EVENT_UPLOADS_CEILING) {
        return res.status(400).json({
          error: `Event photo limit must be between 1 and ${MAX_EVENT_UPLOADS_CEILING}`,
        });
      }
      updates.max_event_uploads = String(Math.floor(n));
    }

    if (req.body.eventCreationEnabled != null) {
      updates.event_creation_enabled = req.body.eventCreationEnabled ? '1' : '0';
    }

    if (req.body.imageAccessTtlHours != null) {
      const n = Number(req.body.imageAccessTtlHours);
      if (!Number.isFinite(n) || n < 1 || n > 168) {
        return res.status(400).json({ error: 'Image link expiry must be between 1 and 168 hours' });
      }
      updates.image_access_ttl_hours = String(Math.floor(n));
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No settings to update' });
    }

    const settings = await setSettings(updates);
    res.json({ settings: settingsPayload(settings) });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Failed to save settings. Did you run migrate_app_settings.sql?',
    });
  }
});

router.post('/change-password', changePasswordLimiter, async (req, res) => {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    if (newPassword === DEFAULT_ADMIN_PASSWORD) {
      return res.status(400).json({ error: 'Choose a password other than the default one' });
    }

    const [rows] = await pool.query(
      'SELECT id, email, role, password_hash FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );
    if (!rows.length || !rows[0].password_hash) {
      return res.status(400).json({ error: 'Password login is not available for this account' });
    }

    const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
    // A fresh token, so a sign-in that was limited to changing the default
    // password gets full access without logging in again.
    res.json({ ok: true, token: signToken(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

router.get('/spotlight', async (_req, res) => {
  try {
    await expireWeekPick();
    const standings = await loadAdminStandings();
    const [pendingRows] = await pool.query(
      `SELECT s.id, s.title, s.image_url, s.spotlight_details, s.created_at, u.display_name, u.email
       FROM strips s
       JOIN users u ON u.id = s.user_id
       WHERE s.spotlight_opt_in = 1 AND s.spotlight_status = 'pending'
         AND s.event_id IS NULL AND s.user_id IS NOT NULL
       ORDER BY s.id ASC`
    );
    const [eligible] = await pool.query(
      `SELECT s.id, s.title, s.image_url, s.created_at, u.display_name
       FROM strips s
       JOIN users u ON u.id = s.user_id
       WHERE s.spotlight_opt_in = 1 AND s.spotlight_status = 'approved'
         AND s.event_id IS NULL AND s.user_id IS NOT NULL
       ORDER BY s.id DESC`
    );
    const [picks] = await pool.query(
      `SELECT p.id, p.strip_id, p.slot, p.caption, p.created_at, s.title, u.display_name
       FROM spotlight_picks p
       JOIN strips s ON s.id = p.strip_id
       JOIN users u ON u.id = s.user_id
       WHERE s.spotlight_opt_in = 1 AND s.spotlight_status = 'approved' AND s.event_id IS NULL
       ORDER BY p.id ASC`
    );
    const pending = await mapStripRows(pendingRows, (row) => ({
      credit: row.display_name || 'Customer',
      email: row.email || null,
      spotlightDetails: parseSpotlightDetails(row.spotlight_details),
      spotlightStatus: 'pending',
    }));
    const strips = await mapStripRows(eligible, (row) => ({
      credit: row.display_name || 'Customer',
      spotlightStatus: 'approved',
    }));
    const mappedPicks = picks.map((row) => ({
      id: row.id,
      stripId: row.strip_id,
      slot: row.slot,
      caption: row.caption || null,
      title: row.title || null,
      credit: row.display_name || 'Customer',
      createdAt: row.created_at,
    }));
    const week = mappedPicks.find((pick) => pick.slot === 'week' && weekIsCurrent(pick.createdAt));
    res.json({
      pending,
      strips,
      picks: mappedPicks,
      standings,
      weekLockedUntil: week ? weekEndsAt(week.createdAt).toISOString() : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load Spotlight' });
  }
});

router.post('/spotlight/review', async (req, res) => {
  try {
    const stripId = Number(req.body.stripId);
    const action = String(req.body.action || '').trim().toLowerCase();
    if (!Number.isFinite(stripId) || stripId < 1) {
      return res.status(400).json({ error: 'A strip is required' });
    }
    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ error: 'Action must be approve or reject' });
    }

    const [rows] = await pool.query(
      `SELECT id, user_id, event_id, spotlight_opt_in, spotlight_status
       FROM strips WHERE id = ? LIMIT 1`,
      [stripId]
    );
    const strip = rows[0];
    if (!strip || strip.event_id != null || !strip.user_id || !strip.spotlight_opt_in) {
      return res.status(404).json({ error: 'Spotlight submission not found' });
    }
    if (strip.spotlight_status !== 'pending') {
      return res.status(409).json({ error: 'That strip is not waiting for review' });
    }

    if (action === 'reject') {
      await pool.query(
        `UPDATE strips
         SET spotlight_opt_in = 0, spotlight_status = 'rejected', spotlight_week_start = NULL
         WHERE id = ?`,
        [strip.id]
      );
      await pool.query('DELETE FROM spotlight_picks WHERE strip_id = ?', [strip.id]);
      await pool.query('DELETE FROM spotlight_likes WHERE strip_id = ?', [strip.id]);
      return res.json({ ok: true, stripId: strip.id, spotlightStatus: 'rejected' });
    }

    const tz = await getSpotlightTz();
    const weekKey = weekStartKey(new Date(), tz);
    await pool.query(
      `UPDATE strips
       SET spotlight_status = 'approved', spotlight_week_start = ?
       WHERE id = ?`,
      [weekKey, strip.id]
    );
    res.json({ ok: true, stripId: strip.id, spotlightStatus: 'approved', weekStart: weekKey });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to review Spotlight submission' });
  }
});

router.post('/spotlight', async (req, res) => {
  try {
    const stripId = Number(req.body.stripId);
    const slot = String(req.body.slot || '');
    const caption = String(req.body.caption || '').trim().slice(0, 500) || null;
    if (!Number.isFinite(stripId) || stripId < 1) {
      return res.status(400).json({ error: 'A strip is required' });
    }
    if (slot !== 'week' && slot !== 'home') {
      return res.status(400).json({ error: 'Slot must be week or home' });
    }

    const [strips] = await pool.query(
      `SELECT id, user_id, event_id, spotlight_opt_in, spotlight_status
       FROM strips WHERE id = ? LIMIT 1`,
      [stripId]
    );
    const strip = strips[0];
    if (
      !strip ||
      strip.event_id != null ||
      !strip.user_id ||
      !strip.spotlight_opt_in ||
      strip.spotlight_status !== 'approved'
    ) {
      return res.status(400).json({ error: 'Only an approved personal strip can be featured' });
    }

    if (slot === 'week') {
      await expireWeekPick();
      const [current] = await pool.query(
        "SELECT id, created_at FROM spotlight_picks WHERE slot = 'week' ORDER BY id DESC LIMIT 1"
      );
      if (current.length && weekIsCurrent(current[0].created_at)) {
        return res.status(403).json({
          error: 'Photo of the week stays until Sunday midnight. It can be changed after this week ends.',
        });
      }
      await pool.query("DELETE FROM spotlight_picks WHERE slot = 'week'");
    } else {
      const [same] = await pool.query(
        "SELECT id FROM spotlight_picks WHERE slot = 'home' AND strip_id = ? LIMIT 1",
        [strip.id]
      );
      if (same.length) {
        return res.status(400).json({ error: 'That strip is already on the home carousel' });
      }
      const [[countRow]] = await pool.query(
        "SELECT COUNT(*) AS count FROM spotlight_picks WHERE slot = 'home'"
      );
      if (Number(countRow.count) >= HOME_LIMIT) {
        return res.status(400).json({ error: 'The home carousel already has 3 photos' });
      }
    }

    const [result] = await pool.query(
      'INSERT INTO spotlight_picks (strip_id, slot, caption) VALUES (?, ?, ?)',
      [strip.id, slot, caption]
    );
    res.status(201).json({ pick: { id: result.insertId, stripId: strip.id, slot, caption } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to feature strip' });
  }
});

router.delete('/spotlight/:id', async (req, res) => {
  try {
    const [existing] = await pool.query(
      'SELECT id, slot, created_at FROM spotlight_picks WHERE id = ? LIMIT 1',
      [req.params.id]
    );
    if (!existing.length) {
      return res.status(404).json({ error: 'Pick not found' });
    }
    if (existing[0].slot === 'week' && weekIsCurrent(existing[0].created_at)) {
      return res.status(403).json({
        error: 'Photo of the week stays until Sunday midnight. It can be changed after this week ends.',
      });
    }
    const [result] = await pool.query('DELETE FROM spotlight_picks WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Pick not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove pick' });
  }
});

router.get('/feedback', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT f.id, f.name, f.email, f.message, f.status, f.created_at, f.user_id,
              u.display_name AS user_display_name
       FROM feedback f
       LEFT JOIN users u ON u.id = f.user_id
       ORDER BY
         CASE WHEN f.status = 'new' THEN 0 ELSE 1 END,
         f.id DESC
       LIMIT 200`
    );
    res.json({
      feedback: rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        message: row.message,
        status: row.status || 'new',
        createdAt: row.created_at,
        userId: row.user_id,
        userDisplayName: row.user_display_name || null,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load feedback. Did you run migrate_feedback.sql?' });
  }
});

router.post('/feedback/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const status = String(req.body?.status || '').trim().toLowerCase();
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid feedback id' });
    }
    if (!['new', 'read', 'done'].includes(status)) {
      return res.status(400).json({ error: 'Status must be new, read, or done' });
    }
    const [result] = await pool.query(
      'UPDATE feedback SET status = ? WHERE id = ?',
      [status, id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Feedback not found' });
    }
    res.json({ ok: true, id, status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update feedback' });
  }
});

module.exports = router;
