const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { TICKET_PACKS, getTicketAccount } = require('../utils/tickets');

const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const account = await getTicketAccount(req.user.id);
    res.json({ ...account, packs: TICKET_PACKS });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load tickets' });
  }
});

router.post('/purchase', async (req, res) => {
  try {
    const pack = Number(req.body.pack);
    if (!TICKET_PACKS.includes(pack)) {
      return res.status(400).json({ error: 'Choose a 1, 5, or 10 ticket pack' });
    }

    const note = `Ticket pack x${pack}`;
    await pool.query(
      `INSERT INTO payments (user_id, event_id, amount, currency, type, status, note)
       VALUES (?, NULL, ?, 'PHP', 'event_hosting', 'pending', ?)`,
      [req.user.id, pack, note]
    );

    const account = await getTicketAccount(req.user.id);
    res.status(201).json({
      ok: true,
      pending: true,
      pack,
      ...account,
      message: 'Payment is pending. Tickets are added when the pack is marked paid.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to request tickets. Did you run migrate_payments.sql?' });
  }
});

module.exports = router;
