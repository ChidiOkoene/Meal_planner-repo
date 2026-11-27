# ADR 009: Clerk for sign-in, roles in our own database

**Status:** Accepted

## Context

Families abroad, dietitians and operations staff sign in to the web app. Parents and vendors never sign in (WhatsApp and one-time links). Staff can see health data, and some will be contractors with personal email addresses rather than a company Google Workspace or Microsoft 365 account.

## Decision

- **Clerk** handles identity: sign-up, sign-in, sessions, passkeys and 2-step verification.
- **Families** sign in with Google, Apple or an emailed link. No passwords.
- **Staff** join only by invitation from an admin, sign in with their email or Google account, and must use 2-step verification (an authenticator app) to reach the staff console.
- **Roles live in our database** (`staff_roles`), not in Clerk. Clerk proves who someone is; our API decides what they may do. An invitation carries a role once, and it is applied on first sign-in.
- **The API accepts Bearer tokens only** (not cookies), verified on every request, so other sites can't act as a signed-in user.
- Removing a staff role ends that person's sessions immediately.

## Consequences

- Swapping the provider later touches only `AuthProviderGateway` and the token verifier in `apps/api/src/auth`, plus the web app's Clerk components.
- Clerk's backend SDK does not say whether a user has a passkey, so staff are required to have **2-step verification** (authenticator app). Passkeys remain available as a convenient first sign-in step.
- Enterprise SSO (SAML) for partner organisations is possible later; it is not needed now.
- Alternatives considered: Auth0 (more configuration, smaller free tier) and running our own auth (more risk, no benefit at this stage).
