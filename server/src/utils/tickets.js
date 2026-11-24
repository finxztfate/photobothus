const { pool } = require('../db');

const POTW_WINS_PER_TICKET = 3;
const TICKET_PACKS = [1, 5, 10];
const PACK_BONUS_TICKETS = { 1: 0, 5: 1, 10: 2 };
const DEFAULT_TICKET_PRICE_PHP = 149;
// Pack / Host vs buying singles: ~13% off 5, ~20% off 10 at the default unit price.
const DEFAULT_PACK_PHP = { 1: 149, 5: 649, 10: 1199 };

function unitPricePhp() {
  const unit = Number(process.env.TICKET_PRICE_PHP || DEFAULT_TICKET_PRICE_PHP);
  return unit > 0 ? unit : DEFAULT_TICKET_PRICE_PHP;
}

function packListPricePhp(pack) {
  return unitPricePhp() * Number(pack);
}

function packPricePhp(pack) {
  const n = Number(pack);
  const override = Number(process.env[`TICKET_PACK_${n}_PHP`] || 0);
  if (override > 0) return override;
  const unit = unitPricePhp();
  if (n === 1) return unit;
  const defaultList = DEFAULT_TICKET_PRICE_PHP * n;
  const defaultSale = DEFAULT_PACK_PHP[n];
  if (defaultSale) return Math.round((unit * n * defaultSale) / defaultList);
  return unit * n;
}

function ticketPriceList() {
  return Object.fromEntries(TICKET_PACKS.map((pack) => [pack, packPricePhp(pack)]));
}

function ticketListPriceList() {
  return Object.fromEntries(TICKET_PACKS.map((pack) => [pack, packListPricePhp(pack)]));
}

function packBonusTickets(pack) {
  return PACK_BONUS_TICKETS[Number(pack)] || 0;
}

function ticketsGrantedForPack(pack) {
  const n = Number(pack);
  return n + packBonusTickets(n);
}

function ticketBonusList() {
  return Object.fromEntries(TICKET_PACKS.map((pack) => [pack, packBonusTickets(pack)]));
}

function ticketGrantedList() {
  return Object.fromEntries(TICKET_PACKS.map((pack) => [pack, ticketsGrantedForPack(pack)]));
}

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
  packPricePhp,
  packListPricePhp,
  ticketPriceList,
  ticketListPriceList,
  packBonusTickets,
  ticketsGrantedForPack,
  ticketBonusList,
  ticketGrantedList,
  ticketAccount,
  getTicketAccount,
  addTickets,
  spendEventTicket,
  recordPotwWin,
};
