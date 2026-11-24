const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  estimateEventStripLimit,
  parseAllowedLayouts,
  isLayoutAllowed,
} = require('../src/utils/eventLayouts');

test('lighter layouts raise the suggested strip limit', () => {
  assert.equal(estimateEventStripLimit(30, [3]), 75); // Polaroid = 1 photo
  assert.equal(estimateEventStripLimit(30, [1]), 30); // Classic = 4 photos
  assert.equal(estimateEventStripLimit(30, [9]), 21); // 6-photo grid
  assert.equal(estimateEventStripLimit(30, null), 30); // all layouts → admin base
});

test('mixed layouts use the heaviest photo count', () => {
  assert.equal(estimateEventStripLimit(30, [3, 1]), 30);
  assert.equal(estimateEventStripLimit(30, [3, 9]), 21);
});

test('parseAllowedLayouts keeps only valid ids', () => {
  assert.deepEqual(parseAllowedLayouts([3, 99, '1', 3]), [1, 3]);
  assert.equal(parseAllowedLayouts([]), null);
  assert.equal(parseAllowedLayouts(null), null);
});

test('isLayoutAllowed treats null as all layouts', () => {
  assert.equal(isLayoutAllowed(null, 9), true);
  assert.equal(isLayoutAllowed([3], 9), false);
  assert.equal(isLayoutAllowed([3, 1], 1), true);
});
