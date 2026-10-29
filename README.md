# Stenotipisi Web Application

ASTREA company web application for stenotyping / transcript management.

## Getting Started

```bash
npm install
npm run dev
```

This starts both:
- **Web app** at [http://localhost:5173](http://localhost:5173)
- **API server** at [http://localhost:3001](http://localhost:3001)

## Local database

By default (no Supabase env vars), data is stored as JSON under `database/`.

Seed user (created automatically):

| Field | Value |
|-------|-------|
| Email | `c.karaolis@galatariotis.com` |
| Password | `Xka123!` |
| Name | Χριστόφορος Καραυλής |

MFA is enabled. Print the current TOTP code with `npm run mfa`.

Passwords are stored as salted hashes, not plain text. To re-initialize the local database:

```bash
npm run seed
```

## Deploy to Vercel + Supabase

1. Create a Supabase project and run:
   - [`supabase/migrations/20261027120000_init.sql`](supabase/migrations/20261027120000_init.sql)
   - [`supabase/storage.sql`](supabase/storage.sql)
2. Import existing local JSON (optional) and/or seed the admin user:
   ```bash
   set SUPABASE_URL=...
   set SUPABASE_SERVICE_ROLE_KEY=...
   npm run db:import-supabase
   npm run db:seed-supabase
   ```
3. Create a Vercel project from this repo. Set env vars from [`.env.example`](.env.example):
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`
   - `APP_PUBLIC_URL` (your Vercel URL)
   - `CORS_ORIGIN` (same URL)
   - Email provider vars as needed
4. Deploy. The Vite SPA is served from `dist`; `/api/*` is handled by [`api/index.js`](api/index.js) (Express on Node serverless).

Local development without Supabase continues to use `database/*.json`.

## Pages

- **Sign In** (`/signin`) – Email login, masked password with show/hide toggle, English/Greek language selection
- **Home** (`/`) – Transcripts Steno dashboard with filters and data table

## Email delivery (§1.1)

Emails are always sent to the **Email Address** on the relevant user record.

Two providers are supported (configured via `.env` — see `.env.example`):

| Provider | `EMAIL_PROVIDER` | Notes |
|----------|------------------|--------|
| **PostageApp** (recommended) | `postageapp` | Specialist online service ([postageapp.com](https://www.postageapp.com)). Better deliverability, analytics, and templates. Requires a dedicated client-funded account and DNS (SPF/DKIM/DMARC) setup. |
| **SMTP** | `smtp` | Application’s own SMTP server via Nodemailer. |
| **Console** | `console` | Local development fallback (logs to the API console). |

```bash
cp .env.example .env
# set POSTAGEAPP_API_KEY (+ FROM address), or SMTP_* values
```

When `EMAIL_PROVIDER` is omitted, the server picks PostageApp if `POSTAGEAPP_API_KEY` is set, otherwise SMTP if `SMTP_HOST` is set, otherwise console.

### Sender (§1.1.2)

Default From format: `Astraea <admin@stenotypisi.com>` (`EMAIL_FROM_NAME` + `EMAIL_FROM_EMAIL`).

Multiple senders are supported for different message categories (`scheduling`, `transcripts`, `account`, …) via `EMAIL_SENDER_<KEY>_EMAIL` / `_NAME` or `EMAIL_SENDERS` JSON. Message types map automatically when no explicit sender is passed.

### Subject (§1.1.3)

Subjects are fixed per notification type (e.g. `Job Assigned`, `Job Rejected`, `Transcript Published`) and are **not** parameterised — PostageApp cannot put values such as a job number in the Subject. Job/transcript details stay in the email body.

### Body & design (§1.1.4 / §1.1.5)

Emails use a branded HTML layout aligned with the web app (teal primary, slate text, Astraea / Stenotipisi header). Each body includes:

- notification details (job number, customer, etc. in the body — not the subject)
- clear next-step instructions
- a primary action link to the relevant screen
- a secondary link to the login page

Per-type body copy can be refined in later specification sections.

### Replies (§1.1.7) — Option B selected

| Mode | `EMAIL_REPLY_MODE` | Behaviour |
|------|--------------------|-----------|
| **Option B** (active) | `monitored` | `Reply-To` is set to `EMAIL_MONITORED_REPLY_TO`; the client monitors that mailbox. |
| **Option A** (alternative) | `unmonitored` | Sending address is not monitored. Every email states this and lists administrator contact details. |

Set in `.env`:

```bash
EMAIL_REPLY_MODE=monitored
EMAIL_MONITORED_REPLY_TO=support@stenotypisi.com
```
