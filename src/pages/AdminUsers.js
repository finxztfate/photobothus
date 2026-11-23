import { useEffect, useState } from 'react';
import { apiRequest } from '../utils/api';
import './Gallery.css';
import './AdminDashboard.css';

const GRANT_PACKS = [1, 5, 10];

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

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

  const grantTickets = async (userId, tickets) => {
    setBusyId(userId);
    setError('');
    try {
      const data = await apiRequest('/api/admin/tickets', {
        method: 'POST',
        body: { userId, tickets },
      });
      setUsers((current) =>
        current.map((user) =>
          user.id === userId
            ? { ...user, tickets: data.tickets, potwWins: data.potwWins ?? user.potwWins }
            : user
        )
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const customers = users.filter((user) => user.role === 'customer');

  return (
    <div className="admin-page dash-page">
      <header className="admin-header dash-header">
        <div>
          <h1>Customers</h1>
          <p>
            Premium hosts with accounts. Grant event tickets here after a purchase, or from Payments when you record a paid hosting sale.
          </p>
        </div>
      </header>
      {error && <p className="admin-error">{error}</p>}
      <section className="dash-panel dash-panel-table">
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
            <tr key={user.id}>
              <td data-label="ID">{user.id}</td>
              <td data-label="Email">{user.email}</td>
              <td data-label="Name">{user.displayName || '—'}</td>
              <td data-label="Tickets">{user.tickets ?? 0}</td>
              <td data-label="POTW wins">{user.potwWins ?? 0}</td>
              <td data-label="Created">{new Date(user.createdAt).toLocaleString()}</td>
              <td data-label="Actions">
                <div className="admin-grant">
                  {GRANT_PACKS.map((pack) => (
                    <button
                      key={pack}
                      type="button"
                      className="admin-action-btn"
                      disabled={busyId === user.id}
                      onClick={() => grantTickets(user.id, pack)}
                    >
                      +{pack}
                    </button>
                  ))}
                </div>
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
      </section>
    </div>
  );
}

export default AdminUsers;
