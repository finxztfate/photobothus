/**
 * Limits how many async jobs run at once. Extra callers wait in a short queue;
 * when that queue is full they get a fast 503 instead of piling up forever.
 */
function createLimiter(maxConcurrent, { maxQueued = 40 } = {}) {
  const max = Math.max(1, Number(maxConcurrent) || 1);
  const queueCap = Math.max(0, Number(maxQueued) || 0);
  let active = 0;
  const waiting = [];

  function bump() {
    while (active < max && waiting.length) {
      const next = waiting.shift();
      active += 1;
      next.resolve(release);
    }
  }

  function release() {
    active = Math.max(0, active - 1);
    bump();
  }

  async function run(fn) {
    let slotRelease = release;
    if (active < max) {
      active += 1;
    } else {
      if (waiting.length >= queueCap) {
        const error = new Error('Server is busy. Please try again in a moment.');
        error.status = 503;
        error.code = 'SERVER_BUSY';
        throw error;
      }
      slotRelease = await new Promise((resolve, reject) => {
        waiting.push({ resolve, reject });
      });
    }

    try {
      return await fn();
    } finally {
      slotRelease();
    }
  }

  return { run };
}

/**
 * Caps how many HTTP requests the process handles at once. Beyond the cap,
 * new requests get 503 + Retry-After so the process stays responsive.
 */
function concurrencyGate(maxConcurrent) {
  const max = Math.max(1, Number(maxConcurrent) || 100);
  let active = 0;

  return function concurrencyGateMiddleware(req, res, next) {
    if (active >= max) {
      res.set('Retry-After', '5');
      res.status(503).json({ error: 'Server is busy. Please try again in a moment.' });
      return;
    }

    active += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active = Math.max(0, active - 1);
    };
    res.on('finish', release);
    res.on('close', release);
    next();
  };
}

module.exports = { createLimiter, concurrencyGate };
