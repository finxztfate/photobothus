// Photo lists are paged newest-first by id: ask for `limit` photos older than
// the `before` id. Using the id as the cursor keeps pages stable while new
// photos keep arriving at the top.

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

function readPage(query = {}) {
  const requested = Number.parseInt(query.limit, 10);
  const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, MAX_LIMIT) : DEFAULT_LIMIT;
  const cursor = Number.parseInt(query.before, 10);
  const before = Number.isFinite(cursor) && cursor > 0 ? cursor : null;
  return { limit, before };
}

/**
 * Callers fetch `limit + 1` rows; the extra row only tells us whether another
 * page exists and is never returned.
 */
function pageOf(rows, limit) {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    page,
    hasMore,
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

module.exports = { readPage, pageOf, DEFAULT_LIMIT, MAX_LIMIT };
