# Sign-in and access control

The design is in [ADR 009](adr/009-authentication-provider.md). This page is the setup and operating guide.

## Who signs in, and how

| Who                 | How                                                                              |
| ------------------- | -------------------------------------------------------------------------------- |
| Families            | Google, Apple or an emailed link. No passwords.                                  |
| Staff               | By invitation only, then email or Google, plus a code from an authenticator app. |
| Parents and vendors | Never sign in (WhatsApp and one-time links).                                     |

## Setting up Clerk

1. Create an application at [clerk.com](https://clerk.com). Development and production are separate instances with separate keys.
2. **Sign-in options** (Configure → User & authentication):
   - Turn on **Email** with **email link or code**.
   - Turn on **Passkeys**.
   - Turn off **Password**.
   - Under Social connections, turn on **Google** and **Apple**.
3. **2-step verification:** nothing to set up. Staff 2-step verification is built into the app (see below), so it works on Clerk's free plan. If you are on a paid plan and turn on Clerk's own **Authenticator app**, that is accepted too. Either way, keep **SMS codes off**: SIM-swap fraud is common, and delivery to foreign numbers is unreliable.
4. **Sessions:** set a sensible maximum lifetime and inactivity timeout, e.g. 7 days for families. Staff sessions are additionally gated by the API.
5. **Keys:** copy the **Publishable key** and **Secret key** into the environment (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) for both the API and the web app. Never commit the secret key.
6. **Allowed origins:** set `CORS_ORIGINS` (and optionally `AUTH_AUTHORIZED_PARTIES`) to the web app's URL. The API rejects tokens issued for any other site.

## Staff 2-step verification

Staff can see health information, so the staff console asks for a second step after Clerk sign-in: a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy or any other). It's built into the app, so it costs nothing on any Clerk plan.

- **First visit to the staff console:** scan a QR code, enter the first code, and save 10 backup codes. The backup codes are shown once.
- **Each sign-in:** enter a code once; that unlocks the console for that sign-in for 12 hours. Signing in again, on any device, asks again.
- **Lost phone:** use a backup code (each works once), or ask an admin to press **Reset 2-step** on `/ops/staff`. The person then sets up a new app at their next visit. Resets are audited.
- **Wrong codes:** after 5 in a row, codes are refused for 15 minutes. Lockouts are audited.

How it's protected:

- Codes follow RFC 6238 (30-second steps, one step of clock drift allowed). A code can never be used twice.
- The app's secret is stored encrypted with the health-data keys, so `DATA_ENCRYPTION_KEYS` must be set (`pnpm keys:generate`, also in development). Backup codes are stored only as hashes.
- Removing someone's staff role also ends their unlocked sessions.
- Clerk's own 2-step, on paid plans, is accepted instead.

### Switching it off for development

`STAFF_REQUIRE_TWO_FACTOR=false` skips the second step, e.g. for quick local testing:

- It only works outside production. With `NODE_ENV=production`, the API refuses to start.
- Staff roles still apply. Only the 2-step requirement is relaxed.
- The staff console shows a red banner while it's off.

## Making the first admin

Invitations need an admin, so the first one is made by hand:

1. Sign up on the web app like any family.
2. Run `pnpm staff:grant you@example.com admin` against that environment's database.
3. Open **/ops/staff**, set up your authenticator app when asked, and invite everyone else.

## Staff access

- **Inviting:** `/ops/staff` → email and role → **Send invitation**. The role is applied when they sign up through the link, and only once.
- **Removing:** one click per role. It ends all of that person's sessions immediately, and an old invitation can never bring the role back.
- **2-step verification:** until they enter a code, a staff member is signed in but the staff console stays locked, showing the setup or code screen.
- **Review** the staff list monthly and remove anyone who no longer needs access.

## How the API enforces it

- Every route requires a valid session unless marked `@Public()`. Today only the health checks and `/v1/meta` are public.
- `@StaffOnly(...roles)` requires a staff role (admins pass every check) **and** 2-step verification passed in the current session: a code from the built-in authenticator app (or a backup code), or Clerk's own 2-step.
- `@HouseholdAccess()` lets household members, plus ops staff and admins for support, see a household. Anyone else gets 404, so household ids can't be probed.
- Identity details (email, name, 2-step status) are refreshed from Clerk at most every 5 minutes. Roles come from our database on every request.

## Troubleshooting

- **Signed in on Clerk, but the app treats you as signed out.** The web server and API fetch Clerk's signing keys from `api.clerk.com` to check each session. Behind an outbound HTTP proxy, Node.js 22+ only uses the proxy when `NODE_USE_ENV_PROXY=1` is set; otherwise those fetches fail and every session looks invalid. Alternatively, set `CLERK_JWT_KEY` (the PEM public key from Clerk's API keys page) so sessions are checked without a network call.
- **Automated browser tests are blocked** ("For your security, this request could not be completed"). That is Clerk's bot protection. Tests on the development instance get a testing token from `POST https://api.clerk.com/v1/testing_tokens` and add it to requests to the Clerk frontend API as `__clerk_testing_token`, and use test emails ending in `+clerk_test` with the code `424242`.
