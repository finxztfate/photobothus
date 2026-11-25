# Photobothus API

## Setup
1. Create MySQL database by running `sql/schema.sql` in phpMyAdmin or MySQL CLI.
2. Copy `.env.example` to `.env` and set DB credentials (XAMPP default user is usually `root` with empty password).
3. `npm install`
4. `npm run dev` — API on http://localhost:4000

## Seed admin
- Email: `admin@photobothus.local`
- Password: `admin123` — a one-time password. The first sign-in only lets you set a new one in Settings; nothing else in the dashboard opens until you do.
- On a live site (`NODE_ENV=production` or Railway) `admin123` is refused. Set `ADMIN_PASSWORD` and run `npm run db:init` instead.
- Admin uses email/password at `/admin/login` (not Google).

## Tests
`npm test` runs the API tests in `test/`. They use an in-memory stand-in for MySQL (`test-support/fakeDb.js`), so no database is needed.

## Google customer auth
1. Create an OAuth Client ID (Web) in Google Cloud Console.
2. Add authorized JavaScript origins: both `http://localhost` and `http://localhost:3000` (a blank white Google popup usually means an origin is missing)
3. Set the same Client ID in:
   - `server/.env` → `GOOGLE_CLIENT_ID=...`
   - project `.env` (copy `.env.example`) → `REACT_APP_GOOGLE_CLIENT_ID=...`
4. If the DB already existed, run `sql/migrate_google_auth.sql`
5. Restart API + React after changing env vars.

## Event start and end time
If the DB already existed, run `npm run db:init` (or `sql/migrate_event_schedule.sql`) to add the `starts_at` / `ends_at` columns. An event closes to guests automatically once its end time passes.

Generate a new admin hash: `npm run hash-password -- yourpassword`

## Deploy on Railway (single service)
`railway.json` builds the React app, serves it from Express, and runs `npm run db:init` (applies `sql/schema.sql`) before each deploy.

1. Create a project from the GitHub repo and add a **MySQL** service.
2. On the app service, set variables:
   - `MYSQL_URL` = `${{MySQL.MYSQL_URL}}`
   - `JWT_SECRET` = a long random string
   - `ADMIN_PASSWORD` = the admin password to use instead of `admin123`
   - `GOOGLE_CLIENT_ID` = your Google OAuth client ID
   - `REACT_APP_GOOGLE_CLIENT_ID` = the same client ID. The project `.env` is no longer committed, so the React build reads this from the service variables.
   - `UPLOADS_DIR` = `/data/uploads`
3. Attach a **Volume** to the app service mounted at `/data` (otherwise uploaded strips are lost on redeploy). Photos are saved on that volume as `YYYY/MM/DD/<random>.<ext>` and removed when the strip or its event is deleted. The file bytes are encrypted with `PHOTO_ENCRYPTION_KEY` (64 hex characters). Without that same key the photos cannot be opened. Files already stored as a single filename in the same directory still load. Passwords are stored only as bcrypt hashes, which cannot be turned back into the original password.
4. Generate a public domain, then add `https://<your-domain>` to the OAuth client's authorized JavaScript origins in Google Cloud Console.
