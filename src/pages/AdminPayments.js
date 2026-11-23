import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../utils/api';
import './Gallery.css';
import './AdminDashboard.css';

function formatMoney(amount, currency = 'PHP') {
  try {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  } catch {
    return `${currency} ${Number(amount || 0).toFixed(2)}`;
  }
}

function labelType(type) {
  return String(type || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({
    amount: '',
    type: 'event_hosting',
    status: 'paid',
    note: '',
    userId: '',
    tickets: '1',
  });

  const loadPayments = async () => {
    const data = await apiRequest('/api/admin/payments');
    setPayments(data.payments || []);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [usersData] = await Promise.all([
          apiRequest('/api/admin/users'),
          loadPayments(),
        ]);
        if (!cancelled) setCustomers(usersData.users || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(
    () =>
      payments.filter((pay) => {
        if (statusFilter !== 'all' && pay.status !== statusFilter) return false;
        if (typeFilter !== 'all' && pay.type !== typeFilter) return false;
        return true;
      }),
    [payments, statusFilter, typeFilter]
  );

  const totals = useMemo(() => {
    const paid = filtered.filter((p) => p.status === 'paid');
    const sum = paid.reduce((acc, p) => acc + Number(p.amount || 0), 0);
    return {
      count: filtered.length,
      paidCount: paid.length,
      paidTotal: sum,
    };
  }, [filtered]);

  const handleRecord = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiRequest('/api/admin/payments', {
        method: 'POST',
        body: {
          amount: Number(form.amount),
          type: form.type,
          status: form.status,
          note: form.note,
          userId: form.userId ? Number(form.userId) : undefined,
          tickets: form.tickets ? Number(form.tickets) : undefined,
        },
      });
      setForm({ amount: '', type: 'event_hosting', status: 'paid', note: '', userId: '', tickets: '1' });
      await loadPayments();
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
          <h1>Payments</h1>
          <p>Full ledger for event hosting and package sales.</p>
        </div>
      </header>
      {error && <p className="admin-error">{error}</p>}

      <section className="dash-bottom-row">
        <div className="dash-panel">
          <div className="dash-panel-head">
            <div>
              <h2>Ledger</h2>
              <p className="dash-muted">
                Showing {totals.count} · Paid {formatMoney(totals.paidTotal)} ({totals.paidCount})
              </p>
            </div>
          </div>

          <div className="admin-filters">
            <label>
              Status
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="refunded">Refunded</option>
                <option value="failed">Failed</option>
              </select>
            </label>
            <label>
              Type
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="event_hosting">Event hosting</option>
                <option value="strip_pack">Strip pack</option>
                <option value="premium">Premium</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>

          <div className="dash-table-wrap">
            <table className="admin-table dash-table dash-table-responsive">
            <thead>
              <tr>
                <th>Amount</th>
                <th>Type</th>
                <th>Status</th>
                <th>Note</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((pay) => (
                <tr key={pay.id}>
                  <td data-label="Amount">{formatMoney(pay.amount, pay.currency)}</td>
                  <td data-label="Type">{labelType(pay.type)}</td>
                  <td data-label="Status">{pay.status}</td>
                  <td data-label="Note">{pay.note || '—'}</td>
                  <td data-label="When">{new Date(pay.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {!filtered.length && (
                <tr className="dash-table-empty">
                  <td colSpan={5}>No payments match these filters.</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>

        <div className="dash-panel dash-money-panel">
          <div className="dash-panel-head">
            <div>
              <h2>Record payment</h2>
              <p className="dash-muted">Log cash / transfer sales manually.</p>
            </div>
          </div>
          <form className="dash-form" onSubmit={handleRecord}>
            <label>
              Amount (PHP)
              <input
                type="number"
                min="1"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
                required
              />
            </label>
            <div className="dash-form-row">
              <label>
                Type
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                >
                  <option value="event_hosting">Event hosting</option>
                  <option value="strip_pack">Strip pack</option>
                  <option value="premium">Premium</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                Status
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="refunded">Refunded</option>
                  <option value="failed">Failed</option>
                </select>
              </label>
            </div>
            <div className="dash-form-row">
              <label>
                Customer
                <select
                  value={form.userId}
                  onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
                >
                  <option value="">No host (ledger only)</option>
                  {customers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {(user.displayName ? `${user.displayName} · ` : '') + user.email}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tickets to issue
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={form.tickets}
                  onChange={(e) => setForm((f) => ({ ...f, tickets: e.target.value }))}
                  placeholder="0"
                />
              </label>
            </div>
            <label>
              Note
              <input
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="What this payment was for"
              />
            </label>
            <button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Add payment'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

export default AdminPayments;
