const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { rateLimit } = require('../src/middleware/rateLimit');

// Runs one request through the limiter and reports what it answered.
function run(limiter, { ip = '1.2.3.4', outcome = 200 } = {}) {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.headers = {};
  res.set = (name, value) => {
    res.headers[name] = value;
    return res;
  };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };

  let passed = false;
  limiter({ ip }, res, () => {
    passed = true;
    res.statusCode = outcome;
    res.emit('finish');
  });
  return { passed, status: res.statusCode, body: res.body, retryAfter: res.headers['Retry-After'] };
}

test('blocks once the limit is reached and says when to retry', () => {
  const limiter = rateLimit({ windowMs: 60000, max: 3, message: 'Slow down' });
  assert.deepEqual([run(limiter).passed, run(limiter).passed, run(limiter).passed], [true, true, true]);

  const blocked = run(limiter);
  assert.equal(blocked.passed, false);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error, 'Slow down');
  assert.ok(Number(blocked.retryAfter) > 0);
});

test('each address has its own allowance', () => {
  const limiter = rateLimit({ windowMs: 60000, max: 1, message: 'Slow down' });
  assert.equal(run(limiter, { ip: '1.1.1.1' }).passed, true);
  assert.equal(run(limiter, { ip: '1.1.1.1' }).passed, false);
  assert.equal(run(limiter, { ip: '2.2.2.2' }).passed, true);
});

test('countOnlyFailures ignores successes and server errors', () => {
  const limiter = rateLimit({ windowMs: 60000, max: 2, message: 'Slow down', countOnlyFailures: true });
  for (let i = 0; i < 5; i += 1) {
    assert.equal(run(limiter, { outcome: 200 }).passed, true);
    assert.equal(run(limiter, { outcome: 500 }).passed, true);
  }
  assert.equal(run(limiter, { outcome: 401 }).passed, true);
  assert.equal(run(limiter, { outcome: 401 }).passed, true);
  assert.equal(run(limiter, { outcome: 200 }).passed, false);
});

test('the allowance comes back after the window', async () => {
  const limiter = rateLimit({ windowMs: 40, max: 1, message: 'Slow down' });
  assert.equal(run(limiter).passed, true);
  assert.equal(run(limiter).passed, false);
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(run(limiter).passed, true);
});
