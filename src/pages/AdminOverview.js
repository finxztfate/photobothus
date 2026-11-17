import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiRequest } from '../utils/api';
import './Gallery.css';
import './AdminDashboard.css';

function formatMoney(amount, currency = 'PHP') {
  try {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Number(amount || 0));
  } catch {
    return `${currency} ${Number(amount || 0).toFixed(0)}`;
  }
}

function formatMoneyExact(amount, currency = 'PHP') {
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

function AdminOverview() {
  const { firstName = 'Admin' } = useOutletContext() || {};
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [activityView, setActivityView] = useState('customers');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest('/api/admin/stats');
        if (!cancelled) setStats(data.stats);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const activityKey =
    activityView === 'customers' ? 'signups' : activityView === 'users' ? 'users' : 'strips';
  const activityLabel =
    activityView === 'customers' ? 'Customers' : activityView === 'users' ? 'Users' : 'Guests';
  // Chart colours come from the admin theme tokens in AdminDashboard.css
  const activityColor = 'var(--admin-chart-bar)';

  const topCustomers = (stats?.topCustomers || []).map((customer) => ({
    name:
      (customer.displayName || customer.email || 'Customer').length > 16
        ? `${(customer.displayName || customer.email).slice(0, 16)}…`
        : customer.displayName || customer.email || 'Customer',
    strips: customer.stripCount,
  }));

  return (
    <div className="dash-page">
      <section className="dash-welcome">
        <h1>HI, {String(firstName).toUpperCase()}</h1>
        <p>Dashboard</p>
      </section>

      {error && <p className="admin-error">{error}</p>}

      {stats && (
        <div className="dash-layout">
          <section className="dash-kpi-grid" aria-label="Key metrics">
            <article className="dash-card dash-stat-card dash-stat-featured">
              <h2>Live Events</h2>
              <p className="dash-stat-value">{stats.activeEvents}</p>
              <p className="dash-stat-meta">{stats.events} total events</p>
              <div className="dash-stat-chart" aria-hidden={!(stats.chart14d || []).length}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.chart14d || []} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="liveEventsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--admin-chart-fill)" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="var(--admin-chart-fill)" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <Tooltip
                      formatter={(value) => [value, 'Active events']}
                      labelFormatter={(label) => label}
                    />
                    <Area
                      type="monotone"
                      dataKey="liveEvents"
                      name="Active events"
                      stroke="var(--admin-chart-line)"
                      fill="url(#liveEventsFill)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: 'var(--admin-chart-line)' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </article>
            <article className="dash-card dash-stat-card">
              <h2>Customers</h2>
              <p className="dash-stat-value">{stats.customers}</p>
              <p className="dash-stat-meta">{stats.activeCustomers30d ?? 0} active (30d)</p>
            </article>
            <article className="dash-card dash-stat-card">
              <h2>Users</h2>
              <p className="dash-stat-value">{stats.users ?? 0}</p>
              <p className="dash-stat-meta">{stats.usersToday ?? 0} today</p>
            </article>
          </section>

          <section className="dash-card dash-card-revenue">
            <div className="dash-card-head dash-card-head-stack">
              <h2>Revenue</h2>
              <span>
                {formatMoney(stats.revenueMonth, stats.currency)} this month · 14-day trend
              </span>
            </div>
            <div className="dash-chart dash-chart-revenue">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.chart14d || []}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--admin-chart-fill)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--admin-chart-fill)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-chart-grid)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'var(--admin-chart-tick)' }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--admin-chart-tick)' }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                    tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
                  />
                  <Tooltip formatter={(value) => formatMoneyExact(value, stats.currency)} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="var(--admin-chart-line)"
                    fill="url(#revenueFill)"
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="dash-grid-bottom">
            <article className="dash-card">
              <div className="dash-card-head dash-card-head-stack">
                <h2>Top Customer</h2>
                <Link className="dash-link" to="/admin/users">
                  View all
                </Link>
              </div>
              {topCustomers.length ? (
                <div className="dash-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topCustomers} layout="vertical" margin={{ left: 4, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-chart-grid)" horizontal={false} />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: 'var(--admin-chart-tick)' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={72}
                        tick={{ fontSize: 11, fill: 'var(--admin-chart-label)' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip />
                      <Bar dataKey="strips" name="Strips" fill="var(--admin-chart-bar)" radius={[0, 8, 8, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="dash-muted">No customer activity yet.</p>
              )}
            </article>

            <article className="dash-card">
              <div className="dash-card-head dash-card-head-stack">
                <h2>Activity</h2>
                <div className="dash-segment" role="tablist" aria-label="Activity metric">
                  <button
                    type="button"
                    className={activityView === 'customers' ? 'is-active' : ''}
                    onClick={() => setActivityView('customers')}
                  >
                    Customer
                  </button>
                  <button
                    type="button"
                    className={activityView === 'users' ? 'is-active' : ''}
                    onClick={() => setActivityView('users')}
                  >
                    Users
                  </button>
                  <button
                    type="button"
                    className={activityView === 'guests' ? 'is-active' : ''}
                    onClick={() => setActivityView('guests')}
                  >
                    Guest
                  </button>
                </div>
              </div>
              <div className="dash-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.chart14d || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-chart-grid)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: 'var(--admin-chart-tick)' }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: 'var(--admin-chart-tick)' }}
                      axisLine={false}
                      tickLine={false}
                      width={28}
                    />
                    <Tooltip />
                    <Bar
                      dataKey={activityKey}
                      name={activityLabel}
                      fill={activityColor}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          </section>
        </div>
      )}
    </div>
  );
}

export default AdminOverview;
