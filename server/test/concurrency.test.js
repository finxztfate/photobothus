const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLimiter, concurrencyGate } = require('../src/utils/concurrency');
const { EventEmitter } = require('node:events');

test('createLimiter runs at most N jobs at once', async () => {
  const limiter = createLimiter(2, { maxQueued: 10 });
  let active = 0;
  let peak = 0;

  await Promise.all(
    Array.from({ length: 6 }, () =>
      limiter.run(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 20));
        active -= 1;
      })
    )
  );

  assert.equal(peak, 2);
  assert.equal(active, 0);
});

test('createLimiter returns 503 when the wait queue is full', async () => {
  const limiter = createLimiter(1, { maxQueued: 1 });
  let releaseFirst;
  const first = limiter.run(
    () =>
      new Promise((resolve) => {
        releaseFirst = resolve;
      })
  );

  // Fill the single queue slot.
  const queued = limiter.run(async () => 'queued');

  await assert.rejects(
    () => limiter.run(async () => 'too-many'),
    (err) => err.status === 503 && err.code === 'SERVER_BUSY'
  );

  releaseFirst();
  assert.equal(await first, undefined);
  assert.equal(await queued, 'queued');
});

test('concurrencyGate refuses excess in-flight requests', () => {
  const gate = concurrencyGate(1);
  const first = new EventEmitter();
  first.status = () => first;
  first.json = () => first;
  first.set = () => first;

  let passed = 0;
  gate({}, first, () => {
    passed += 1;
  });
  assert.equal(passed, 1);

  const second = new EventEmitter();
  second.headers = {};
  second.set = (name, value) => {
    second.headers[name] = value;
    return second;
  };
  second.status = (code) => {
    second.statusCode = code;
    return second;
  };
  second.json = (body) => {
    second.body = body;
    return second;
  };

  gate({}, second, () => {
    passed += 1;
  });
  assert.equal(passed, 1);
  assert.equal(second.statusCode, 503);
  assert.match(second.body.error, /busy/i);

  first.emit('finish');
  gate({}, second, () => {
    passed += 1;
  });
  assert.equal(passed, 2);
});
