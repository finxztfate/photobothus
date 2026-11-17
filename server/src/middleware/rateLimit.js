// Small in-memory limiter, keyed by client IP. It is enough for a single API
// instance; if the API is ever run as several instances, replace the Map with
// a shared store so the count is not per-process.
function rateLimit({ windowMs, max, message, countOnlyFailures = false }) {
  const hits = new Map(); // ip -> { count, resetAt }

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs);
  sweep.unref();

  function record(key) {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }
    entry.count += 1;
  }

  return function rateLimitMiddleware(req, res, next) {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const entry = hits.get(key);

    if (entry && entry.resetAt > now && entry.count >= max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      res.status(429).json({ error: message || 'Too many requests. Please try again later.' });
      return;
    }

    if (countOnlyFailures) {
      // Count the attempt once the outcome is known, so successful requests
      // (and server-side errors, which are not the caller's fault) never use
      // up the allowance.
      res.on('finish', () => {
        if (res.statusCode >= 400 && res.statusCode < 500) record(key);
      });
    } else {
      record(key);
    }
    next();
  };
}

module.exports = { rateLimit };
