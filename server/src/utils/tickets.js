const { pool } = require('../db');

const POTW_WINS_PER_TICKET = 3;
const TICKET_PACKS = [1, 5, 10];

function ticketAccount(row) {
  const tickets = Number(row?.event_tickets || 0);
  const potwWins = Number(row?.potw_wins || 0);
  const remainder = potwWins % POTW_WINS_PER_TICKET;
  return {
    tickets,
    potwWins,
    potwWinsUntilTicket: remainder === 0 ? POTW_WINS_PER_TICKET : POTW_WINS_PER_TICKET - remainder,
  };
}

async function getTicketAccount(userId) {
  const [rows] = await pool.query(
    'SELECT event_tickets, potw_wins FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  return ticketAccount(rows[0]);
}

async function addTickets(userId, count) {
  const n = Number(count);
  if (!Number.isInteger(n) || n < 1) {
    const err = new Error('Ticket count must be a positive whole number');
    err.status = 400;
    throw err;
  }
  const [result] = await pool.query(
    'UPDATE users SET event_tickets = event_tickets + ? WHERE id = ?',
    [n, userId]
  );
  if (!result.affectedRows) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return getTicketAccount(userId);
}

async function spendEventTicket(userId) {
  const [result] = await pool.query(
    'UPDATE users SET event_tickets = event_tickets - 1 WHERE id = ? AND event_tickets > 0',
    [userId]
  );
  return result.affectedRows > 0;
}

async function recordPotwWin(userId) {
  if (!userId) return { potwWins: 0, ticketGranted: false };
  await pool.query('UPDATE users SET potw_wins = potw_wins + 1 WHERE id = ?', [userId]);
  const [rows] = await pool.query('SELECT potw_wins FROM users WHERE id = ? LIMIT 1', [userId]);
  const potwWins = Number(rows[0]?.potw_wins || 0);
  let ticketGranted = false;
  if (potwWins > 0 && potwWins % POTW_WINS_PER_TICKET === 0) {
    await addTickets(userId, 1);
    ticketGranted = true;
  }
  return { potwWins, ticketGranted };
}

module.exports = {
  POTW_WINS_PER_TICKET,
  TICKET_PACKS,
  ticketAccount,
  getTicketAccount,
  addTickets,
  spendEventTicket,
  recordPotwWin,
};
