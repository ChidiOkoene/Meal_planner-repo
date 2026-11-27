import { verifyToken } from '@clerk/backend';

/** Claims the API uses from a verified session token. */
export interface SessionClaims {
  /** Auth provider user id. */
  sub: string;
  /** Session id. */
  sid?: string;
  /** Minutes since the first and second factor were verified; -1 if never in this session. */
  fva?: [number, number];
}

export interface TokenVerifierOptions {
  /** Backend secret key; used to fetch the signing keys when no public key is given. */
  secretKey?: string;
  /** PEM public key for verifying without a network call. */
  jwtKey?: string;
  /** Web origins allowed to have issued the token (the `azp` claim). */
  authorizedParties: string[];
}

export type VerifyResult = { ok: true; claims: SessionClaims } | { ok: false; reason: string };

export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');

export interface TokenVerifier {
  readonly configured: boolean;
  verify(token: string): Promise<VerifyResult>;
}

/** Verifies Clerk session tokens: signature, expiry, and which web app issued them. */
export class ClerkTokenVerifier implements TokenVerifier {
  readonly configured: boolean;

  constructor(private readonly options: TokenVerifierOptions) {
    this.configured = Boolean(options.secretKey || options.jwtKey);
  }

  async verify(token: string): Promise<VerifyResult> {
    if (!this.configured) return { ok: false, reason: 'not_configured' };
    let result: Awaited<ReturnType<typeof verifyToken>>;
    try {
      result = await verifyToken(token, {
        secretKey: this.options.secretKey,
        jwtKey: this.options.jwtKey,
        authorizedParties:
          this.options.authorizedParties.length > 0 ? this.options.authorizedParties : undefined,
        clockSkewInMs: 10_000,
      });
    } catch (error) {
      // Some SDK versions throw instead of returning errors; treat both the same.
      return { ok: false, reason: (error as { reason?: string }).reason ?? 'invalid_token' };
    }
    // The exported verifyToken returns the claims directly and throws on failure; the inner
    // function returns { data } or { errors }. Accept both.
    const shaped = result as unknown as { data?: unknown; errors?: { reason?: string }[] };
    if (shaped.errors) return { ok: false, reason: shaped.errors[0]?.reason ?? 'invalid_token' };
    const payload = ('data' in shaped ? shaped.data : result) as SessionClaims | undefined;
    if (!payload) return { ok: false, reason: 'invalid_token' };
    if (typeof payload.sub !== 'string') return { ok: false, reason: 'missing_subject' };
    return { ok: true, claims: payload };
  }
}
