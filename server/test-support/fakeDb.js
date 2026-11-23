// An in-memory stand-in for the MySQL pool, so the route tests run without a
// database. It understands exactly the statements the routes send; anything
// else throws, which makes a changed query show up as a failing test instead
// of silently passing.

const db = require('../src/db');

function createFakeDb() {
  const tables = { users: [], events: [], strips: [], picks: [], settings: new Map() };
  const ids = { users: 0, events: 0, strips: 0, picks: 0 };

  const insert = (table, row) => {
    ids[table] += 1;
    const saved = { id: ids[table], created_at: new Date(), ...row };
    tables[table].push(saved);
    return saved;
  };
  const eventStrips = (eventId) => tables.strips.filter((s) => s.event_id === Number(eventId));
  const withCounts = (event) => {
    const strips = eventStrips(event.id);
    return {
      ...event,
      strip_count: strips.length,
      guest_count: new Set(strips.map((s) => s.guest_key).filter(Boolean)).size,
    };
  };
  // Newest first, optionally only rows older than the `before` id, capped at `limit`.
  const page = (rows, before, limit) =>
    rows
      .filter((row) => before == null || row.id < before)
      .sort((a, b) => b.id - a.id)
      .slice(0, limit);

  const handlers = [
    // ---- users
    [/^SELECT id, email, display_name, avatar_url, role, created_at FROM users WHERE id = \?/, ([id]) =>
      [tables.users.filter((u) => u.id === Number(id))]],
    [/^SELECT id, email, password_hash, google_id, display_name, avatar_url, role, created_at FROM users WHERE google_id = \?/, ([googleId]) =>
      [tables.users.filter((u) => u.google_id === googleId)]],
    [/^SELECT id, email, password_hash, google_id, display_name, avatar_url, role, created_at FROM users WHERE email = \?/, ([email]) =>
      [tables.users.filter((u) => u.email === email)]],
    [/^SELECT id, email, password_hash, display_name, avatar_url, role, created_at FROM users WHERE email = \?/, ([email]) =>
      [tables.users.filter((u) => u.email === email)]],
    [/^UPDATE users SET google_id = \?, display_name = COALESCE\(display_name, \?\), avatar_url = \? WHERE id = \?/, ([googleId, displayName, avatarUrl, id]) => {
      const user = tables.users.find((u) => u.id === Number(id));
      if (user) {
        user.google_id = googleId;
        if (!user.display_name) user.display_name = displayName;
        user.avatar_url = avatarUrl;
      }
      return [{ affectedRows: user ? 1 : 0 }];
    }],
    [/^INSERT INTO users \(email, password_hash, google_id, display_name, avatar_url, role\)/, ([email, googleId, displayName, avatarUrl]) => {
      const row = insert('users', {
        email,
        password_hash: null,
        google_id: googleId,
        display_name: displayName,
        avatar_url: avatarUrl,
        role: 'customer',
      });
      return [{ insertId: row.id }];
    }],
    [/^SELECT id, email, role, password_hash FROM users WHERE id = \?/, ([id]) =>
      [tables.users.filter((u) => u.id === Number(id))]],
    [/^UPDATE users SET last_login_at = NOW\(\) WHERE id = \?/, () => [{ affectedRows: 1 }]],
    [/^UPDATE users SET password_hash = \? WHERE id = \?/, ([hash, id]) => {
      tables.users.find((u) => u.id === Number(id)).password_hash = hash;
      return [{ affectedRows: 1 }];
    }],

    // ---- settings
    [/^SELECT setting_key, setting_value FROM app_settings/, () =>
      [[...tables.settings].map(([setting_key, setting_value]) => ({ setting_key, setting_value }))]],
    [/^INSERT INTO app_settings \(setting_key, setting_value\) SELECT \?, \? WHERE NOT EXISTS/, ([key, value]) => {
      if (!tables.settings.has(key)) tables.settings.set(key, value);
      return [{ affectedRows: 1 }];
    }],
    [/^INSERT INTO app_settings \(setting_key, setting_value\) VALUES \(\?, \?\) ON DUPLICATE KEY UPDATE/, ([key, value]) => {
      tables.settings.set(key, value);
      return [{ affectedRows: 1 }];
    }],

    // ---- events
    [/^SELECT COUNT\(\*\) AS count FROM events WHERE owner_id = \?/, ([ownerId]) =>
      [[{ count: tables.events.filter((e) => e.owner_id === ownerId).length }]]],
    [/^UPDATE events SET is_active = 0, completed_at = ends_at WHERE is_active = 1 AND ends_at IS NOT NULL AND ends_at <= \?/, ([now]) => {
      let affectedRows = 0;
      tables.events.forEach((event) => {
        if (event.is_active === 1 && event.ends_at && event.ends_at <= now) {
          event.is_active = 0;
          event.completed_at = event.ends_at;
          affectedRows += 1;
        }
      });
      return [{ affectedRows }];
    }],
    [/^INSERT INTO events \(owner_id, name, host_name, event_date, starts_at, ends_at, location, welcome_message, hashtags, strips_enabled, code\)/, (p) => {
      const [owner_id, name, host_name, event_date, starts_at, ends_at, location, welcome_message, hashtags, strips_enabled, code] = p;
      const row = insert('events', {
        owner_id, name, host_name, event_date, starts_at, ends_at, location, welcome_message,
        hashtags, strips_enabled, code, is_active: 1, completed_at: null,
      });
      return [{ insertId: row.id }];
    }],
    [/^UPDATE events SET name = \?, host_name = \?, event_date = \?, starts_at = \?, ends_at = \?, location = \?, welcome_message = \?, hashtags = \?, strips_enabled = \?, is_active = \?, completed_at = \? WHERE id = \?/, (p) => {
      const [name, host_name, event_date, starts_at, ends_at, location, welcome_message, hashtags, strips_enabled, is_active, completed_at, id] = p;
      Object.assign(tables.events.find((e) => e.id === Number(id)), {
        name, host_name, event_date, starts_at, ends_at, location, welcome_message, hashtags,
        strips_enabled, is_active, completed_at,
      });
      return [{ affectedRows: 1 }];
    }],
    [/^SELECT e\.\*, COUNT\(s\.id\) AS strip_count FROM events e LEFT JOIN strips s ON s\.event_id = e\.id WHERE e\.owner_id = \?/, ([ownerId]) =>
      [tables.events.filter((e) => e.owner_id === ownerId).sort((a, b) => b.id - a.id).map(withCounts)]],
    [/^SELECT e\.\*, COUNT\(s\.id\) AS strip_count, COUNT\(DISTINCT s\.guest_key\) AS guest_count FROM events e LEFT JOIN strips s ON s\.event_id = e\.id WHERE e\.id = \? AND e\.owner_id = \?/, ([id, ownerId]) =>
      [tables.events.filter((e) => e.id === Number(id) && e.owner_id === ownerId).map(withCounts)]],
    [/^SELECT e\.\*, COUNT\(s\.id\) AS strip_count(?:, COUNT\(DISTINCT s\.guest_key\) AS guest_count)? FROM events e LEFT JOIN strips s ON s\.event_id = e\.id WHERE e\.id = \?/, ([id]) =>
      [tables.events.filter((e) => e.id === Number(id)).map(withCounts)]],
    [/^SELECT \* FROM events WHERE id = \? AND owner_id = \?/, ([id, ownerId]) =>
      [tables.events.filter((e) => e.id === Number(id) && e.owner_id === ownerId)]],
    [/^SELECT \* FROM events WHERE id = \?/, ([id]) => [tables.events.filter((e) => e.id === Number(id))]],
    [/^SELECT id(?:, name)?(?:, is_active)? FROM events WHERE id = \? AND owner_id = \?/, ([id, ownerId]) =>
      [tables.events.filter((e) => e.id === Number(id) && e.owner_id === ownerId)]],
    [/^SELECT owner_id(?:, is_active)? FROM events WHERE id = \?/, ([id]) => [tables.events.filter((e) => e.id === Number(id))]],
    [/^SELECT id, name, host_name, event_date, starts_at, ends_at, location, welcome_message, hashtags, strips_enabled, code, is_active, created_at FROM events WHERE code = \?/, ([code]) =>
      [tables.events.filter((e) => e.code === code)]],
    [/^SELECT id, is_active FROM events WHERE code = \?/, ([code]) => [tables.events.filter((e) => e.code === code)]],
    [/^DELETE FROM events WHERE id = \?/, ([id]) => {
      const before = tables.events.length;
      tables.events = tables.events.filter((e) => e.id !== Number(id));
      tables.strips = tables.strips.filter((s) => s.event_id !== Number(id)); // ON DELETE CASCADE
      return [{ affectedRows: before - tables.events.length }];
    }],

    // ---- strips
    [/^SELECT id, user_id, guest_key, event_id, title, image_url, layout_id, photo_urls, look_json, created_at FROM strips WHERE event_id = \? AND \(\? IS NULL OR id < \?\) ORDER BY id DESC LIMIT \?/, ([eventId, before, , limit]) =>
      [page(eventStrips(eventId), before, limit)]],
    [/^SELECT id, user_id, event_id, title, image_url, spotlight_opt_in, spotlight_details, created_at FROM strips WHERE user_id = \? AND event_id IS NULL AND \(\? IS NULL OR id < \?\) ORDER BY id DESC LIMIT \?/, ([userId, before, , limit]) =>
      [page(tables.strips.filter((s) => s.user_id === userId && s.event_id == null), before, limit)]],
    [/^SELECT s\.id, s\.user_id, s\.event_id, s\.title, s\.image_url, s\.created_at, u\.email AS user_email, e\.name AS event_name, e\.code AS event_code FROM strips s LEFT JOIN users u ON u\.id = s\.user_id LEFT JOIN events e ON e\.id = s\.event_id WHERE \(\? IS NULL OR s\.id < \?\) ORDER BY s\.id DESC LIMIT \?/, ([before, , limit]) =>
      [page(tables.strips, before, limit).map((s) => {
        const event = tables.events.find((e) => e.id === s.event_id);
        const user = tables.users.find((u) => u.id === s.user_id);
        return { ...s, user_email: user?.email ?? null, event_name: event?.name ?? null, event_code: event?.code ?? null };
      })]],
    [/^SELECT s\.id FROM strips s JOIN events e ON e\.id = s\.event_id WHERE s\.id = \? AND s\.event_id = \? AND e\.owner_id = \?/, ([stripId, eventId, ownerId]) =>
      [tables.strips.filter((s) =>
        s.id === Number(stripId) && s.event_id === Number(eventId) &&
        tables.events.some((e) => e.id === s.event_id && e.owner_id === ownerId))]],
    [/^SELECT id, title, image_url, photo_urls FROM strips WHERE event_id = \? ORDER BY id ASC/, ([eventId]) =>
      [eventStrips(eventId).sort((a, b) => a.id - b.id)]],
    [/^SELECT id, title, image_url FROM strips WHERE event_id = \? ORDER BY id ASC/, ([eventId]) =>
      [eventStrips(eventId).sort((a, b) => a.id - b.id)]],
    [/^SELECT DISTINCT e\.id FROM events e JOIN strips s ON s\.event_id = e\.id WHERE e\.is_active = 0/, () => {
      const ids = [...new Set(
        tables.strips
          .filter((strip) => tables.events.some((event) => event.id === strip.event_id && event.is_active === 0))
          .map((strip) => strip.event_id)
      )];
      return [ids.map((id) => ({ id }))];
    }],
    [/^SELECT id, image_url, photo_urls FROM strips WHERE event_id = \?/, ([eventId]) => [eventStrips(eventId)]],
    [/^SELECT id, image_url FROM strips WHERE event_id = \?/, ([eventId]) => [eventStrips(eventId)]],
    [/^DELETE FROM strips WHERE event_id = \?/, ([eventId]) => {
      const doomed = new Set(eventStrips(eventId).map((strip) => strip.id));
      const before = tables.strips.length;
      tables.strips = tables.strips.filter((strip) => strip.event_id !== Number(eventId));
      tables.picks = tables.picks.filter((pick) => !doomed.has(pick.strip_id));
      return [{ affectedRows: before - tables.strips.length }];
    }],
    [/^SELECT image_url, photo_urls FROM strips WHERE event_id = \?/, ([eventId]) => [eventStrips(eventId)]],
    [/^SELECT image_url FROM strips WHERE event_id = \?/, ([eventId]) => [eventStrips(eventId)]],
    [/^SELECT COUNT\(\*\) AS count FROM strips WHERE event_id = \? AND guest_key = \?/, ([eventId, guestKey]) =>
      [[{ count: eventStrips(eventId).filter((s) => s.guest_key === guestKey).length }]]],
    [/^SELECT COUNT\(\*\) AS count FROM strips WHERE event_id = \?/, ([eventId]) => [[{ count: eventStrips(eventId).length }]]],
    [/^SELECT COUNT\(\*\) AS count FROM strips$/, () => [[{ count: tables.strips.length }]]],
    [/^INSERT INTO strips \(user_id, guest_key, event_id, title, image_url, layout_id, photo_urls, look_json\) VALUES \(NULL, \?, \?, \?, \?, \?, \?, \?\)/, ([guest_key, event_id, title, image_url, layout_id, photo_urls, look_json]) =>
      [{ insertId: insert('strips', { user_id: null, guest_key, event_id, title, image_url, layout_id, photo_urls, look_json }).id }]],
    [/^SELECT \* FROM strips WHERE id = \? AND event_id = \? AND guest_key = \?/, ([id, eventId, guestKey]) =>
      [tables.strips.filter((s) => s.id === Number(id) && s.event_id === Number(eventId) && s.guest_key === guestKey)]],
    [/^SELECT \* FROM strips WHERE id = \? AND event_id = \?/, ([id, eventId]) =>
      [tables.strips.filter((s) => s.id === Number(id) && s.event_id === Number(eventId))]],
    [/^UPDATE strips SET look_json = \? WHERE event_id = \? AND id <> \?/, ([lookJson, eventId, skipId]) => {
      const matches = tables.strips.filter(
        (s) => s.event_id === Number(eventId) && s.id !== Number(skipId)
      );
      matches.forEach((strip) => {
        strip.look_json = lookJson;
      });
      return [{ affectedRows: matches.length }];
    }],
    [/^UPDATE strips SET look_json = \? WHERE event_id = \?/, ([lookJson, eventId]) => {
      const matches = tables.strips.filter((s) => s.event_id === Number(eventId));
      matches.forEach((strip) => {
        strip.look_json = lookJson;
      });
      return [{ affectedRows: matches.length }];
    }],
    [/^UPDATE strips SET image_url = COALESCE\(\?, image_url\) WHERE id = \?/, ([imageUrl, id]) => {
      const strip = tables.strips.find((s) => s.id === Number(id));
      if (strip && imageUrl != null) strip.image_url = imageUrl;
      return [{ affectedRows: strip ? 1 : 0 }];
    }],
    [/^UPDATE strips SET image_url = COALESCE\(\?, image_url\), look_json = COALESCE\(\?, look_json\) WHERE id = \?/, ([imageUrl, lookJson, id]) => {
      const strip = tables.strips.find((s) => s.id === Number(id));
      if (strip) {
        if (imageUrl != null) strip.image_url = imageUrl;
        if (lookJson != null) strip.look_json = lookJson;
      }
      return [{ affectedRows: strip ? 1 : 0 }];
    }],
    [/^INSERT INTO strips \(user_id, event_id, title, image_url\) VALUES \(\?, NULL, \?, \?\)/, ([user_id, title, image_url]) =>
      [{ insertId: insert('strips', { user_id, guest_key: null, event_id: null, title, image_url }).id }]],
    [/^SELECT id FROM strips WHERE id = \? AND user_id = \? AND event_id IS NULL/, ([id, userId]) =>
      [tables.strips.filter((s) => s.id === Number(id) && s.user_id === userId && s.event_id == null)]],
    [/^SELECT id, image_url FROM strips WHERE user_id = \? AND event_id IS NULL AND id IN \([\s?,]+\)/, (params) => {
      const userId = params[0];
      const ids = new Set(params.slice(1).map(Number));
      return [tables.strips.filter((s) => s.user_id === userId && s.event_id == null && ids.has(s.id))];
    }],
    [/^SELECT id, image_url, photo_urls FROM strips WHERE id = \?/, ([id]) => [tables.strips.filter((s) => s.id === Number(id))]],
    [/^SELECT id, image_url FROM strips WHERE id = \?/, ([id]) => [tables.strips.filter((s) => s.id === Number(id))]],
    [/^SELECT \* FROM strips WHERE id = \?/, ([id]) => [tables.strips.filter((s) => s.id === Number(id))]],
    [/^DELETE FROM strips WHERE id = \?/, ([id]) => {
      const before = tables.strips.length;
      tables.strips = tables.strips.filter((s) => s.id !== Number(id));
      tables.picks = tables.picks.filter((pick) => pick.strip_id !== Number(id));
      return [{ affectedRows: before - tables.strips.length }];
    }],
    [/^UPDATE strips SET spotlight_opt_in = \? WHERE id = \?/, ([flag, id]) => {
      const strip = tables.strips.find((s) => s.id === Number(id));
      if (strip) strip.spotlight_opt_in = flag;
      return [{ affectedRows: strip ? 1 : 0 }];
    }],
    [/^UPDATE strips SET spotlight_opt_in = \?, spotlight_details = \? WHERE id = \?/, ([flag, details, id]) => {
      const strip = tables.strips.find((s) => s.id === Number(id));
      if (strip) {
        strip.spotlight_opt_in = flag;
        strip.spotlight_details = details;
      }
      return [{ affectedRows: strip ? 1 : 0 }];
    }],
    [/^DELETE FROM spotlight_picks WHERE strip_id = \?/, ([stripId]) => {
      const before = tables.picks.length;
      tables.picks = tables.picks.filter((pick) => pick.strip_id !== Number(stripId));
      return [{ affectedRows: before - tables.picks.length }];
    }],
    [/^DELETE FROM spotlight_picks WHERE slot = 'week' AND created_at <= DATE_SUB\(NOW\(\), INTERVAL 7 DAY\)/, () => {
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const before = tables.picks.length;
      tables.picks = tables.picks.filter((pick) => {
        if (pick.slot !== 'week') return true;
        return new Date(pick.created_at).getTime() > cutoff;
      });
      return [{ affectedRows: before - tables.picks.length }];
    }],
    [/^DELETE FROM spotlight_picks WHERE slot = 'week'/, () => {
      const before = tables.picks.length;
      tables.picks = tables.picks.filter((pick) => pick.slot !== 'week');
      return [{ affectedRows: before - tables.picks.length }];
    }],
    [/^DELETE FROM spotlight_picks WHERE id = \?/, ([id]) => {
      const before = tables.picks.length;
      tables.picks = tables.picks.filter((pick) => pick.id !== Number(id));
      return [{ affectedRows: before - tables.picks.length }];
    }],
    [/^SELECT id, created_at FROM spotlight_picks WHERE slot = 'week' ORDER BY id DESC LIMIT 1/, () =>
      [[...tables.picks].filter((pick) => pick.slot === 'week').sort((a, b) => b.id - a.id).slice(0, 1)]],
    [/^SELECT id, slot, created_at FROM spotlight_picks WHERE id = \? LIMIT 1/, ([id]) =>
      [tables.picks.filter((pick) => pick.id === Number(id))]],
    [/^SELECT id FROM spotlight_picks WHERE slot = 'home' AND strip_id = \?/, ([stripId]) =>
      [tables.picks.filter((pick) => pick.slot === 'home' && pick.strip_id === Number(stripId))]],
    [/^SELECT COUNT\(\*\) AS count FROM spotlight_picks WHERE slot = 'home'/, () =>
      [[{ count: tables.picks.filter((pick) => pick.slot === 'home').length }]]],
    [/^SELECT id, user_id, event_id, spotlight_opt_in FROM strips WHERE id = \?/, ([id]) =>
      [tables.strips.filter((s) => s.id === Number(id))]],
    [/^INSERT INTO spotlight_picks \(strip_id, slot, caption\) VALUES \(\?, \?, \?\)/, ([strip_id, slot, caption]) =>
      [{ insertId: insert('picks', { strip_id, slot, caption }).id }]],
    [/^SELECT s\.id, s\.title, s\.image_url, s\.created_at, u\.display_name FROM strips s JOIN users u ON u\.id = s\.user_id WHERE s\.spotlight_opt_in = 1 AND s\.event_id IS NULL AND s\.user_id IS NOT NULL ORDER BY s\.id DESC/, () =>
      [tables.strips
        .filter((s) => s.spotlight_opt_in && s.event_id == null && s.user_id)
        .sort((a, b) => b.id - a.id)
        .map((s) => ({ ...s, display_name: tables.users.find((u) => u.id === s.user_id)?.display_name ?? null }))]],
    [/^SELECT p\.id, p\.strip_id, p\.slot, p\.caption, p\.created_at, s\.title, u\.display_name FROM spotlight_picks p JOIN strips s ON s\.id = p\.strip_id JOIN users u ON u\.id = s\.user_id WHERE s\.spotlight_opt_in = 1 AND s\.event_id IS NULL ORDER BY p\.id ASC/, () =>
      [tables.picks
        .filter((pick) => {
          const strip = tables.strips.find((s) => s.id === pick.strip_id);
          return strip && strip.spotlight_opt_in && strip.event_id == null && strip.user_id;
        })
        .sort((a, b) => a.id - b.id)
        .map((pick) => {
          const strip = tables.strips.find((s) => s.id === pick.strip_id);
          const user = tables.users.find((u) => u.id === strip.user_id);
          return { ...pick, title: strip.title, display_name: user?.display_name ?? null };
        })]],
    [/^SELECT p\.id AS pick_id, p\.slot, p\.caption, s\.id, s\.user_id, s\.title, s\.image_url, s\.spotlight_details, s\.created_at, u\.display_name FROM spotlight_picks p JOIN strips s ON s\.id = p\.strip_id JOIN users u ON u\.id = s\.user_id WHERE s\.spotlight_opt_in = 1 AND s\.event_id IS NULL AND s\.user_id IS NOT NULL ORDER BY p\.id ASC/, () =>
      [tables.picks
        .filter((pick) => {
          const strip = tables.strips.find((s) => s.id === pick.strip_id);
          return strip && strip.spotlight_opt_in && strip.event_id == null && strip.user_id;
        })
        .sort((a, b) => a.id - b.id)
        .map((pick) => {
          const strip = tables.strips.find((s) => s.id === pick.strip_id);
          const user = tables.users.find((u) => u.id === strip.user_id);
          return {
            pick_id: pick.id,
            slot: pick.slot,
            caption: pick.caption,
            id: strip.id,
            user_id: strip.user_id,
            title: strip.title,
            image_url: strip.image_url,
            spotlight_details: strip.spotlight_details,
            created_at: strip.created_at,
            display_name: user?.display_name ?? null,
          };
        })]],
  ];

  async function query(sql, params = []) {
    const statement = sql.replace(/\s+/g, ' ').trim();
    const match = handlers.find(([pattern]) => pattern.test(statement));
    if (!match) {
      throw new Error(`fakeDb does not know this query: ${statement}`);
    }
    return match[1](params);
  }

  return {
    tables,
    query,
    addUser: (row) => insert('users', { display_name: null, avatar_url: null, password_hash: null, google_id: null, role: 'customer', ...row }),
    addEvent: (row) =>
      insert('events', {
        host_name: null, event_date: null, starts_at: null, ends_at: null, location: null,
        welcome_message: null, hashtags: null, strips_enabled: 0, is_active: 1, completed_at: null,
        code: `code${ids.events + 1}`, ...row,
      }),
    addStrip: (row) => insert('strips', {
      user_id: null, guest_key: null, event_id: null, title: null, image_url: 'missing.png',
      layout_id: null, photo_urls: null, look_json: null, spotlight_opt_in: 0, spotlight_details: null, ...row,
    }),
  };
}

/** Replaces the real pool's query with the fake one and returns the fake. */
function installFakeDb() {
  const fake = createFakeDb();
  db.pool.query = fake.query;
  return fake;
}

module.exports = { installFakeDb };
