# Sign-in and access control

The design is in [ADR 009](adr/009-authentication-provider.md). This page is the setup and operating guide.

## Who signs in, and how

| Who                 | How                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------- |
| Families            | Google, Apple or an emailed link. No passwords.                                         |
| Staff               | By invitation only, then email or Google, plus 2-step verification (authenticator app). |
| Parents and vendors | Never sign in (WhatsApp and one-time links).                                            |

## Setting up Clerk

1. Create an application at [clerk.com](https://clerk.com). Development and production are separate instances with separate keys.
2. **Sign-in options** (Configure → User & authentication):
   - Turn on **Email** with **email link or code**.
   - Turn on **Passkeys**.
   - Turn off **Password**.
   - Under Social connections, turn on **Google** and **Apple**.
3. **2-step verification:** turn on **Authenticator app** and **Backup codes**. Turn **off SMS codes**: SIM-swap fraud is common, and delivery to foreign numbers is unreliable.
4. **Sessions:** set a sensible maximum lifetime and inactivity timeout, e.g. 7 days for families. Staff sessions are additionally gated by the API.
5. **Keys:** copy the **Publishable key** and **Secret key** into the environment (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) for both the API and the web app. Never commit the secret key.
6. **Allowed origins:** set `CORS_ORIGINS` (and optionally `AUTH_AUTHORIZED_PARTIES`) to the web app's URL. The API rejects tokens issued for any other site.

## If your Clerk plan has no 2-step verification

On Clerk, 2-step verification (authenticator app) is a paid feature. To build and test the staff console before paying, set `STAFF_REQUIRE_TWO_FACTOR=false`:

- It only works outside production. With `NODE_ENV=production`, the API refuses to start.
- Staff roles still apply. Only the 2-step requirement is relaxed.
- The staff console shows a red banner while it's off.

Before real health data goes in, either upgrade Clerk and turn on the authenticator app, or build our own authenticator-app check for staff.

## Making the first admin

Invitations need an admin, so the first one is made by hand:

1. Sign up on the web app like any family.
2. Run `pnpm staff:grant you@example.com admin` against that environment's database.
3. Turn on 2-step verification under **Account → Security**, then sign out and back in using it.
4. Open **/ops/staff** to invite everyone else.

## Staff access

- **Inviting:** `/ops/staff` → email and role → **Send invitation**. The role is applied when they sign up through the link, and only once.
- **Removing:** one click per role. It ends all of that person's sessions immediately, and an old invitation can never bring the role back.
- **2-step verification:** without it, a staff member is signed in but the staff console stays locked, with a message telling them what to do.
- **Review** the staff list monthly and remove anyone who no longer needs access.

## How the API enforces it

- Every route requires a valid session unless marked `@Public()`. Today only the health checks and `/v1/meta` are public.
- `@StaffOnly(...roles)` requires a staff role (admins pass every check) **and** 2-step verification that was used in the current session.
- `@HouseholdAccess()` lets household members, plus ops staff and admins for support, see a household. Anyone else gets 404, so household ids can't be probed.
- Identity details (email, name, 2-step status) are refreshed from Clerk at most every 5 minutes. Roles come from our database on every request.

## Troubleshooting

- **Signed in on Clerk, but the app treats you as signed out.** The web server and API fetch Clerk's signing keys from `api.clerk.com` to check each session. Behind an outbound HTTP proxy, Node.js 22+ only uses the proxy when `NODE_USE_ENV_PROXY=1` is set; otherwise those fetches fail and every session looks invalid. Alternatively, set `CLERK_JWT_KEY` (the PEM public key from Clerk's API keys page) so sessions are checked without a network call.
- **Automated browser tests are blocked** ("For your security, this request could not be completed"). That is Clerk's bot protection. Tests on the development instance get a testing token from `POST https://api.clerk.com/v1/testing_tokens` and add it to requests to the Clerk frontend API as `__clerk_testing_token`, and use test emails ending in `+clerk_test` with the code `424242`.
