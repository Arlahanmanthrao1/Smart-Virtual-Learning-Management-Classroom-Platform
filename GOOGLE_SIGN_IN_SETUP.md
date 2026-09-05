# Google college-account sign-in

Deployed on 4 September 2026 to the existing FastAPI + React application. Google authentication
is optional: normal email/password login still works. A real OAuth Web client ID
is required before a Google account can be used. No fabricated credentials or
Google login success are used in the application.

**Current public status:** the option is present at
https://smart-virtual-lms-frontend-ruby.vercel.app/login, but disabled because no
`GOOGLE_CLIENT_ID` has been configured. Password login is unaffected.

## Set up your Google client

1. Open [Google Cloud Console](https://console.cloud.google.com/), select or create
   the project for EKEEKRTA, and open **Google Auth Platform**.
2. Set up the app branding/consent information with the real app name, support
   email and developer contact. Use **External** audience for a platform serving
   multiple institutions (an Internal app is restricted to its own organization).
   While in Testing, add the college accounts you will test with as test users.
3. In **Clients**, create an OAuth client with application type **Web application**.
4. Add these **Authorized JavaScript origins**, with no path or trailing slash:

   ```text
   https://smart-virtual-lms-frontend-ruby.vercel.app
   http://localhost:5173
   http://127.0.0.1:5173
   ```

   Add any other local development port you actually use to both Google's origins
   and the backend `ALLOWED_ORIGINS`. Add `https://ekeekrta.hitam.org` only after
   HITAM authorizes and connects that domain. Each future institution domain
   needs its own authorized origin. Do not register arbitrary preview URLs.
5. Copy the **Client ID**, which ends in `.apps.googleusercontent.com`.
   Set `GOOGLE_CLIENT_ID` in `backend/.env` for local development and in the
   **backend Vercel project's Production environment**, then restart/redeploy
   the backend. The frontend reads the public client ID from `/auth/google/config`;
   no Vite client-ID setting or frontend rebuild is required just to enable it.

This integration uses Google's JavaScript **popup callback** mode, not a redirect
callback. No client secret is needed, and no Gmail/Drive API access is requested.
Use Google's own sign-in button. Do not paste a client secret into the browser or
commit it. Client IDs are public identifiers, not passwords.

Official setup: [Google Identity Services configuration](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).

## Account and institution rules

- Students, faculty and HODs must already have accounts created by an institution
  administrator. The institution's first administrator can use Google once their
  existing institution/admin profile has been created. Google never creates users,
  institutions, departments or role permissions automatically.
- Only Google-managed Workspace college accounts are accepted. Both a verified
  email and the Google hosted-domain claim (`hd`) must match the institution's
  registered email domain. Personal Gmail, unverified email and unmanaged third-party
  Google accounts are rejected, even if the email text looks like a college email.
- The first successful login links Google's stable `sub` to the existing account.
  Later sign-ins must match that identity and the current institution/email.
  Reassigned email addresses cannot silently replace an existing Google link.
  Link reassignment requires a separately reviewed operator recovery; no self-service
  unlink/relink interface is included. Password login remains available.
- All dashboard permissions come from the existing database role. Institution-specific
  hostname restrictions apply to Google login and the returned application session.
- Google signature, audience, issuer, expiry and per-page nonce are verified on the
  backend. The callback is JSON-only from an explicitly allowed frontend Origin;
  it does not set cookies or use automatic form-post/redirect login. Google tokens
  are not stored in localStorage; only the normal application session is saved.

Verification guidance: [Google ID-token validation](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

## Deployment and verification

`google_identities` is a new, initially empty table with unique Google subject and
user mappings. It is created through the project's existing `Base.metadata.create_all`
startup path. There is no alteration to existing user columns, passwords or roles.
Keep the normal production backup policy before deploying schema additions.

Without `GOOGLE_CLIENT_ID`, the button is visibly disabled with a setup notice and
the backend refuses Google authentication. Password sign-in remains functional.
Scripts blocked by browser settings/network show a retry option and password fallback.

Automated tests use isolated databases and locally signed test tokens only. They
cover genuine signature verification, issuer/audience/expiry failures, nonce mismatch,
managed-domain checks, existing-account requirements, persistent subject linking,
role preservation and institution isolation. A real Google browser sign-in must be
tested after the actual client ID and authorized origins are configured.

Release checks: 79 backend tests passed, including nine Google-authentication
tests using local RSA signatures; the frontend build, route rendering and Google
script failure/retry checks passed. Public `/auth/google/config` reports no client
ID, and Google sign-in rejects attempts with HTTP 503 until configured.

Deployment IDs: backend `dpl_DqAqsGsdFp61RhvxU9pLq9jYReKX`; frontend
`dpl_8HaZ9UzrCBFstfBiwtr429rkfBsf`. Before-deployment backup:
`C:/Users/arlah/ekeekrta-backups/google-signin-20260904-dbaea86c5b0b4ed089e6182c27e6037a/before-google-signin.dump`.
Existing table fingerprints matched after deployment; the new identity table is
empty. No real Google identity, new account or dummy academic record was added.
