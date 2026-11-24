const crypto = require('crypto');
const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const {
  TICKET_PACKS,
  packPricePhp,
  ticketPriceList,
  ticketListPriceList,
  ticketsGrantedForPack,
  ticketBonusList,
  ticketGrantedList,
  getTicketAccount,
  addTickets,
} = require('../utils/tickets');

const router = express.Router();

function polarConfig() {
  const token = String(process.env.POLAR_ACCESS_TOKEN || '').trim();
  if (!token) return null;
  const sandbox = String(process.env.POLAR_SERVER || '').toLowerCase() === 'sandbox';
  return {
    token,
    base: sandbox ? 'https://sandbox-api.polar.sh/v1' : 'https://api.polar.sh/v1',
    productId: String(process.env.POLAR_PRODUCT_ID || '').trim(),
    currency: String(process.env.POLAR_CURRENCY || 'php').toLowerCase(),
  };
}

function publicSiteOrigin(req) {
  if (process.env.CLIENT_ORIGIN) {
    return process.env.CLIENT_ORIGIN.split(',')[0].trim().replace(/\/$/, '');
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  const host = req.get('origin') || `${req.protocol}://${req.get('host')}`;
  return String(host).replace(/\/$/, '');
}

async function polarFetch(path, { method = 'GET', body } = {}) {
  const cfg = polarConfig();
  const response = await fetch(`${cfg.base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(data.detail)
      ? data.detail.map((item) => item.msg || JSON.stringify(item)).join('; ')
      : data.detail || data.error || data.message;
    const err = new Error(detail || `Polar request failed (${response.status})`);
    err.status = response.status;
    throw err;
  }
  return data;
}

async function fulfillTicketPayment(paymentId, userId, pack) {
  const [result] = await pool.query(
    "UPDATE payments SET status = 'paid' WHERE id = ? AND status = 'pending'",
    [paymentId]
  );
  if (!result.affectedRows) {
    return getTicketAccount(userId);
  }
  return addTickets(userId, ticketsGrantedForPack(pack));
}

function metadataPack(meta) {
  const userId = Number(meta?.userId);
  const pack = Number(meta?.pack);
  const paymentId = Number(meta?.paymentId);
  if (!Number.isInteger(userId) || !TICKET_PACKS.includes(pack) || !Number.isInteger(paymentId)) {
    return null;
  }
  return { userId, pack, paymentId };
}

async function fulfillFromMetadata(meta) {
  const parsed = metadataPack(meta);
  if (!parsed) return null;
  return fulfillTicketPayment(parsed.paymentId, parsed.userId, parsed.pack);
}

function timingSafeEqualB64(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function verifyPolarWebhook(rawBody, headers, secret) {
  const id = headers['webhook-id'];
  const timestamp = headers['webhook-timestamp'];
  const signatureHeader = String(headers['webhook-signature'] || '');
  if (!id || !timestamp || !signatureHeader || !secret) {
    throw new Error('Missing Polar webhook headers');
  }
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const signed = `${id}.${timestamp}.${body}`;
  const offered = signatureHeader
    .split(' ')
    .map((part) => part.replace(/^v1,/, '').trim())
    .filter(Boolean);

  const expectedUtf8 = crypto.createHmac('sha256', Buffer.from(secret, 'utf8')).update(signed).digest('base64');
  let expectedStd = null;
  try {
    expectedStd = crypto
      .createHmac('sha256', Buffer.from(secret.replace(/^whsec_/, ''), 'base64'))
      .update(signed)
      .digest('base64');
  } catch {
    expectedStd = null;
  }
  const ok = offered.some((sig) => timingSafeEqualB64(sig, expectedUtf8) || (expectedStd && timingSafeEqualB64(sig, expectedStd)));
  if (!ok) throw new Error('Invalid Polar webhook signature');
  return JSON.parse(body);
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const account = await getTicketAccount(req.user.id);
    res.json({
      ...account,
      packs: TICKET_PACKS,
      prices: ticketPriceList(),
      listPrices: ticketListPriceList(),
      bonuses: ticketBonusList(),
      granted: ticketGrantedList(),
      polarEnabled: Boolean(polarConfig()?.productId),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load tickets' });
  }
});

router.post('/purchase', requireAuth, async (req, res) => {
  try {
    const pack = Number(req.body.pack);
    if (!TICKET_PACKS.includes(pack)) {
      return res.status(400).json({ error: 'Choose a 1, 5, or 10 ticket pack' });
    }

    const polar = polarConfig();
    const amount = packPricePhp(pack);
    const granted = ticketsGrantedForPack(pack);
    const bonus = granted - pack;
    const note = bonus > 0 ? `Ticket pack x${pack} (+${bonus} bonus)` : `Ticket pack x${pack}`;
    const [result] = await pool.query(
      `INSERT INTO payments (user_id, event_id, amount, currency, type, status, note)
       VALUES (?, NULL, ?, 'PHP', 'event_hosting', 'pending', ?)`,
      [req.user.id, amount || pack, note]
    );

    if (!polar) {
      const account = await getTicketAccount(req.user.id);
      return res.status(201).json({
        ok: true,
        pending: true,
        pack,
        ...account,
        message: 'Payment is pending. Tickets are added when the pack is marked paid.',
      });
    }

    if (!polar.productId) {
      return res.status(500).json({ error: 'Set POLAR_PRODUCT_ID to your Polar product.' });
    }
    if (!(amount > 0)) {
      return res.status(500).json({
        error: 'Set TICKET_PRICE_PHP (pesos per ticket) or TICKET_PACK_1_PHP / TICKET_PACK_5_PHP / TICKET_PACK_10_PHP.',
      });
    }

    const origin = publicSiteOrigin(req);
    const checkout = await polarFetch('/checkouts/', {
      method: 'POST',
      body: {
        products: [polar.productId],
        prices: {
          [polar.productId]: [
            {
              amount_type: 'fixed',
              price_amount: amount * 100,
              price_currency: polar.currency,
            },
          ],
        },
        success_url: `${origin}/tickets?checkout_id={CHECKOUT_ID}`,
        return_url: `${origin}/tickets?tickets=cancel`,
        customer_email: req.user.email || undefined,
        external_customer_id: String(req.user.id),
        metadata: {
          userId: String(req.user.id),
          pack: String(pack),
          paymentId: String(result.insertId),
        },
      },
    });

    res.status(201).json({
      ok: true,
      pending: true,
      pack,
      checkoutUrl: checkout.url,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to start Polar checkout' });
  }
});

router.post('/confirm', requireAuth, async (req, res) => {
  try {
    if (!polarConfig()) {
      return res.status(400).json({ error: 'Polar is not configured' });
    }
    const checkoutId = String(req.body.checkoutId || req.body.sessionId || '').trim();
    if (!checkoutId) {
      return res.status(400).json({ error: 'Missing Polar checkout id' });
    }
    const checkout = await polarFetch(`/checkouts/${checkoutId}`);
    if (String(checkout.metadata?.userId || checkout.external_customer_id) !== String(req.user.id)) {
      return res.status(403).json({ error: 'This checkout does not belong to you' });
    }
    if (checkout.status !== 'succeeded') {
      return res.status(402).json({ error: 'Payment is not complete yet' });
    }
    const account = await fulfillFromMetadata(checkout.metadata);
    if (!account) {
      return res.status(400).json({ error: 'Checkout is missing ticket metadata' });
    }
    res.json({ ok: true, ...account });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to confirm ticket payment' });
  }
});

async function handlePolarWebhook(req, res) {
  const secret = String(process.env.POLAR_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    return res.status(400).json({ error: 'Polar webhooks are not configured' });
  }
  let event;
  try {
    event = verifyPolarWebhook(req.body, req.headers, secret);
  } catch (err) {
    return res.status(403).json({ error: err.message });
  }
  try {
    if (event.type === 'order.paid') {
      const meta = event.data?.metadata || event.data?.checkout?.metadata;
      let account = await fulfillFromMetadata(meta);
      if (!account && event.data?.checkout_id && polarConfig()) {
        const checkout = await polarFetch(`/checkouts/${event.data.checkout_id}`).catch(() => null);
        if (checkout) account = await fulfillFromMetadata(checkout.metadata);
      }
    }
    if (event.type === 'checkout.updated' && event.data?.status === 'succeeded') {
      await fulfillFromMetadata(event.data?.metadata);
    }
    res.status(202).json({ received: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}

module.exports = router;
module.exports.handlePolarWebhook = handlePolarWebhook;
