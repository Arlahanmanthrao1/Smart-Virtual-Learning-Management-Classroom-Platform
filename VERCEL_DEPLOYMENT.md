# Vercel deployment status and setup

Deploy `frontend` and `backend` as separate Vercel projects. Do not deploy the
repository root. Their `.vercelignore` files exclude local environment files,
keys, databases, environments and test artifacts. No real data is included in
the deployment bundle. Some sensitive files were already tracked by Git before
these exclusions; do not push that repository until its tracking/history has
been reviewed and any exposed credentials rotated.

## Backend environment settings

- `DATABASE_URL`: Neon pooled PostgreSQL URL, preserving SSL options.
- `SECRET_KEY`: a new random secret of at least 32 characters, not the example.
- `ALLOWED_ORIGINS`: exact HTTPS frontend origin; comma-separated for multiple.
- `VIDEO_PROVIDER`: `jaas`.
- `JAAS_APP_ID`: the real JaaS application ID.
- `JAAS_API_KEY_ID`: the full JaaS key ID.
- `JAAS_PRIVATE_KEY`: private PEM contents, stored only as a protected backend
  environment variable. Actual newlines or escaped `\n` are accepted. Do not
  upload your Windows private-key file or use its Windows path online.
- `ALLOWED_EMAIL_DOMAIN`: your college's approved email domain.
- `ERP_BASE_URL`: leave unset/empty unless a real hosted ERP is available.

Set these in the intended deployment environment. Vercel configuration selects
Singapore (`sin1`) and Python 3.12. The app refuses to start on Vercel with local
SQLite, a default/short login secret, or non-HTTPS/wildcard allowed origins.
API documentation is disabled on Vercel; all account creation remains admin-only.

## Frontend settings

Set `VITE_API_BASE_URL` to the deployed HTTPS backend URL, without a trailing
slash. This value is public. No private database/JaaS credentials belong in the
frontend. Build command: `npm run build`; output directory: `dist`.

## Data and verification

A new Neon database is empty. Deployment creates the schema, not accounts or
seed data. Decide whether to migrate the existing authorized records or initialize
a real administrator account before accepting a deployment as usable. The local
database must be preserved. Neither migration nor initial admin creation has
been run by the deployment preparation.

Before sharing: verify backend health, authorized login, anonymous registration
rejection, an administrator-created student login, course enrollment, and a real
two-participant JaaS call from different networks. Check cloud usage allowances.
This is a development LMS, not a completed college-production security audit.
