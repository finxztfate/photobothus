import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../utils/api';
import ConfirmModal from '../components/ConfirmModal';
import './Gallery.css';
import './AdminDashboard.css';

const PACKS = [1, 5, 10];

function customerLabel(user) {
  if (user.displayName) return `${user.displayName} · ${user.email}`;
  return user.email;
}

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [form, setForm] = useState({ userId: '', tickets: '1', note: '' });

  const loadUsers = async () => {
    const data = await apiRequest('/api/admin/users');
    setUsers(data.users || []);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadUsers();
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const customers = users.filter((user) => user.role === 'customer');
  const selected = useMemo(
    () => customers.find((user) => String(user.id) === String(form.userId)) || null,
    [customers, form.userId]
  );
  const ticketCount = Number(form.tickets);
  const canSubmit =
    selected && Number.isInteger(ticketCount) && ticketCount >= 1 && ticketCount <= 99 && form.note.trim();

  const openConfirm = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!canSubmit) {
      setError('Choose a customer, a ticket quantity from 1 to 99, and a reason.');
      return;
    }
    setConfirming(true);
  };

  const grantTickets = async () => {
    setConfirming(false);
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const data = await apiRequest('/api/admin/tickets', {
        method: 'POST',
        body: {
          userId: Number(form.userId),
          tickets: ticketCount,
          note: form.note.trim(),
        },
      });
      setUsers((current) =>
        current.map((user) =>
          user.id === data.userId
            ? { ...user, tickets: data.tickets, potwWins: data.potwWins ?? user.potwWins }
            : user
        )
      );
      setSuccess(
        `Issued ${ticketCount} ticket${ticketCount === 1 ? '' : 's'} to ${selected.email}. Balance is now ${data.tickets}.`
      );
      setForm((current) => ({ ...current, tickets: '1', note: '' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page dash-page">
      <header className="admin-header dash-header">
        <div>
          <h1>Customers</h1>
          <p>
            Host accounts and ticket balances. Issue tickets from the control on the right after a confirmed sale or a recorded complimentary grant.
          </p>
        </div>
      </header>
      {error && <p className="admin-error">{error}</p>}
      {success && <p className="admin-success">{success}</p>}

      <section className="dash-bottom-row">
        <div className="dash-panel dash-panel-table">
          <div className="dash-panel-head">
            <div>
              <h2>Accounts</h2>
              <p className="dash-muted">Select a host to fill the issue form.</p>
            </div>
          </div>
          <div className="dash-table-wrap">
            <table className="admin-table dash-table dash-table-responsive">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Tickets</th>
                  <th>POTW wins</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {customers.map((user) => (
                  <tr
                    key={user.id}
                    className={String(form.userId) === String(user.id) ? 'dash-row-selected' : undefined}
                  >
                    <td data-label="ID">{user.id}</td>
                    <td data-label="Email">{user.email}</td>
                    <td data-label="Name">{user.displayName || '—'}</td>
                    <td data-label="Tickets">{user.tickets ?? 0}</td>
                    <td data-label="POTW wins">{user.potwWins ?? 0}</td>
                    <td data-label="Created">{new Date(user.createdAt).toLocaleString()}</td>
                    <td data-label="Actions">
                      <button
                        type="button"
                        className="admin-action-btn"
                        onClick={() => setForm((current) => ({ ...current, userId: String(user.id) }))}
                      >
                        Issue
                      </button>
                    </td>
                  </tr>
                ))}
                {!customers.length && (
                  <tr className="dash-table-empty">
                    <td colSpan={7}>No customers yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dash-panel dash-money-panel">
          <div className="dash-panel-head">
            <div>
              <h2>Issue tickets</h2>
              <p className="dash-muted">Adds to the host balance and writes a paid ledger line for audit.</p>
            </div>
          </div>
          <form className="dash-form" onSubmit={openConfirm}>
            <label>
              Customer
              <select
                value={form.userId}
                onChange={(e) => setForm((current) => ({ ...current, userId: e.target.value }))}
                required
              >
                <option value="">Select a host</option>
                {customers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {customerLabel(user)} · {user.tickets ?? 0} tickets
                  </option>
                ))}
              </select>
            </label>
            {selected ? (
              <p className="dash-muted">
                Current balance: {selected.tickets ?? 0}. After this grant:{' '}
                {Number.isInteger(ticketCount) && ticketCount > 0
                  ? (selected.tickets ?? 0) + ticketCount
                  : '—'}
              </p>
            ) : null}
            <label>
              Quantity
              <input
                type="number"
                min="1"
                max="99"
                value={form.tickets}
                onChange={(e) => setForm((current) => ({ ...current, tickets: e.target.value }))}
                required
              />
            </label>
            <div className="admin-pack-fill" role="group" aria-label="Sold pack sizes">
              {PACKS.map((pack) => (
                <button
                  key={pack}
                  type="button"
                  className={Number(form.tickets) === pack ? 'is-active' : undefined}
                  onClick={() => setForm((current) => ({ ...current, tickets: String(pack) }))}
                >
                  {pack}-ticket pack
                </button>
              ))}
            </div>
            <label>
              Reason
              <input
                value={form.note}
                onChange={(e) => setForm((current) => ({ ...current, note: e.target.value }))}
                placeholder="Paid GCash transfer, complimentary, replacement…"
                maxLength={255}
                required
              />
            </label>
            <button type="submit" disabled={saving || !customers.length}>
              {saving ? 'Issuing…' : 'Review and issue'}
            </button>
          </form>
        </div>
      </section>

      {confirming && selected && (
        <ConfirmModal
          title="Issue event tickets"
          message={`Grant ${ticketCount} ticket${ticketCount === 1 ? '' : 's'} to ${customerLabel(selected)}? Balance goes from ${selected.tickets ?? 0} to ${(selected.tickets ?? 0) + ticketCount}. This is recorded on the payments ledger.`}
          confirmLabel="Issue tickets"
          onConfirm={grantTickets}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

export default AdminUsers;
