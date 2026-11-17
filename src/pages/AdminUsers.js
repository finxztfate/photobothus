import { useEffect, useState } from 'react';
import { apiRequest } from '../utils/api';
import './Gallery.css';
import './AdminDashboard.css';

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest('/api/admin/users');
        if (!cancelled) setUsers(data.users || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const customers = users.filter((user) => user.role === 'customer');

  return (
    <div className="admin-page dash-page">
      <header className="admin-header dash-header">
        <div>
          <h1>Customers</h1>
          <p>
            Premium hosts with accounts. Guest photobooth participants are counted as Users on the dashboard.
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
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((user) => (
            <tr key={user.id}>
              <td data-label="ID">{user.id}</td>
              <td data-label="Email">{user.email}</td>
              <td data-label="Name">{user.displayName || '—'}</td>
              <td data-label="Created">{new Date(user.createdAt).toLocaleString()}</td>
            </tr>
          ))}
          {!customers.length && (
            <tr className="dash-table-empty">
              <td colSpan={4}>No customers yet.</td>
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
