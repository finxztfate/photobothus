import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { apiRequest } from '../utils/api';
import { useAuth } from '../utils/auth';
import './EventTicketsPage.css';

const PLANS = [
  {
    id: 'earn',
    name: 'Spotlight',
    pack: null,
    priceLabel: 'Free',
    cta: 'Go to Spotlight',
    to: '/spotlight',
    features: [
      '1 ticket every 3 Photo of the Week wins',
      'Same hosted event as a paid ticket',
      'No checkout',
      'Guests never pay',
    ],
  },
  {
    id: 1,
    name: 'Single',
    pack: 1,
    price: 149,
    listPrice: 149,
    features: [
      'Open one hosted event when you need it',
      'Guests join from a QR — they never pay',
      'Photos unlock for everyone when the event ends',
      'Download and restyle the strip as the host',
    ],
  },
  {
    id: 5,
    name: 'Pack',
    pack: 5,
    price: 649,
    listPrice: 745,
    recommended: true,
    features: [
      'Pay for 5 events, get 6 — one extra ticket included',
      '₱130 per paid event instead of ₱149',
      'Keep leftover tickets for the next birthday or office night',
      'Same QR booth, guest gallery, and host download as Single',
      'Guests still never pay',
    ],
  },
  {
    id: 10,
    name: 'Host',
    pack: 10,
    price: 1199,
    listPrice: 1490,
    features: [
      'Pay for 10 events, get 12 — two extra tickets included',
      'Lowest peso per paid event — ₱120 instead of ₱149',
      'Balance stays until you use it; no expiry on unused tickets',
      'Open a new booth the same day without buying again',
      'Guests still never pay',
    ],
  },
];

function formatPrice(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `₱${n.toLocaleString('en-PH')}`;
}

function EventTicketsPage() {
  const { isAuthenticated, isCustomer, loading } = useAuth();
  const [shop, setShop] = useState(null);
  const [error, setError] = useState('');
  const [buying, setBuying] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || !isCustomer) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest('/api/tickets');
        if (!cancelled) setShop(data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load tickets');
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, isCustomer]);

  useEffect(() => {
    if (!isAuthenticated || !isCustomer) return;
    const params = new URLSearchParams(window.location.search);
    const checkoutId = params.get('checkout_id');
    const cancelledPay = params.get('tickets') === 'cancel';
    if (cancelledPay) {
      setError('Checkout was cancelled.');
      window.history.replaceState({}, '', '/tickets');
      return undefined;
    }
    if (!checkoutId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest('/api/tickets/confirm', {
          method: 'POST',
          body: { checkoutId },
        });
        if (cancelled) return;
        setShop((current) => ({ ...(current || {}), ...data }));
        setError('');
        window.history.replaceState({}, '', '/tickets');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not confirm payment');
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, isCustomer]);

  if (loading) return <div className="ticket-pricing-page"><p>Loading…</p></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isCustomer) return <Navigate to="/admin" replace />;

  const buyPack = async (pack) => {
    setError('');
    setBuying(pack);
    try {
      const data = await apiRequest('/api/tickets/purchase', { method: 'POST', body: { pack } });
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setShop((current) => ({ ...(current || {}), ...data }));
      setError(data.message || 'Checkout did not return a payment link.');
    } catch (err) {
      setError(err.message || 'Could not start checkout');
    } finally {
      setBuying(null);
    }
  };

  const tickets = Number(shop?.tickets || 0);
  const checkoutEnabled = shop?.checkoutEnabled !== false && shop?.polarEnabled !== false;
  const checkoutNotice =
    shop && !checkoutEnabled
      ? (shop.checkoutMessage
        || 'Online ticket checkout is not available yet. Earn tickets from Spotlight, or ask an admin to issue tickets.')
      : '';

  return (
    <div className="ticket-pricing-page">
      <header className="ticket-pricing-head">
        <p className="ticket-pricing-kicker">Pricing</p>
        <h1>Event tickets</h1>
        <p>
          You have <strong>{tickets}</strong> ticket{tickets === 1 ? '' : 's'}.
          One ticket creates one hosted event.
        </p>
      </header>
      {checkoutNotice ? <p className="ticket-pricing-notice">{checkoutNotice}</p> : null}
      {error && <p className="ticket-pricing-error">{error}</p>}
      <div className="ticket-pricing-grid">
        {PLANS.map((plan) => {
          const sale = Number(shop?.prices?.[plan.pack] || plan.price || 0);
          const list = Number(shop?.listPrices?.[plan.pack] || plan.listPrice || 0);
          const price = plan.pack ? formatPrice(sale) : plan.priceLabel;
          const listPrice = plan.pack ? formatPrice(list) : null;
          const onSale = Boolean(plan.pack && sale > 0 && list > sale);
          const buyingThis = buying === plan.pack;
          const canBuy = Boolean(shop && checkoutEnabled && buying == null);
          return (
            <article
              key={plan.id}
              className={`ticket-plan${plan.recommended ? ' is-recommended' : ''}${plan.pack && !checkoutEnabled ? ' is-disabled' : ''}`}
            >
              {plan.recommended ? <span className="ticket-plan-badge">Recommended</span> : null}
              <h2>{plan.name}</h2>
              <p className="ticket-plan-price">
                {price || '—'}
                {plan.pack ? <span className="ticket-plan-currency">PHP</span> : null}
                {onSale && listPrice ? <span className="ticket-plan-was">{listPrice}</span> : null}
              </p>
              {plan.to ? (
                <Link to={plan.to} className="ticket-plan-cta ticket-plan-cta-ghost">
                  {plan.cta}
                </Link>
              ) : (
                <button
                  type="button"
                  className="ticket-plan-cta"
                  disabled={!canBuy}
                  onClick={() => buyPack(plan.pack)}
                  title={!checkoutEnabled ? checkoutNotice : undefined}
                >
                  {buyingThis
                    ? 'Opening checkout…'
                    : !checkoutEnabled
                      ? 'Checkout unavailable'
                      : `Buy ${plan.name}`}
                </button>
              )}
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
      <p className="ticket-pricing-foot">
        <Link to="/events/new">Create an event</Link>
        {' · '}
        <Link to="/events">Event dashboard</Link>
      </p>
    </div>
  );
}

export default EventTicketsPage;
