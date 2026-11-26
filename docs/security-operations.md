# Security operations: encryption keys and the audit log

See `docs/ARCHITECTURE.md` §15 for the overall approach.

## Encrypting health data

Sensitive fields (health profiles, readings and similar, from issue #19 on) are encrypted by the application before they reach the database, using envelope encryption:

- Each value gets its own random 256-bit data key (AES-256-GCM).
- The data key is encrypted with a **master key** that never touches the database.
- Stored values look like `enc:v1:<master key id>:…`, so the database and its backups only ever hold ciphertext.

Fields are configured with the `fieldEncryption` Prisma extension in `@dyjext/db`. Its limits:

- **No filtering or sorting on encrypted fields.** The extension refuses it, because such a filter would silently never match.
- **No nested writes from another model.** Write encrypted models through their own client methods, not inside another model's nested `create`; nested writes aren't encrypted.

### Master keys

`DATA_ENCRYPTION_KEYS` holds one or more keys, newest first: `id:base64key,id:base64key`. Generate one with:

```bash
pnpm keys:generate
```

- **Production:** the API refuses to start without valid keys.
- **Where keys live:** in the hosting platform's secret store, never in the repository. When the service moves to a cloud key management service (issue #10), the master key stays inside the KMS and only wrapped data keys leave it.
- **One key per environment:** never copy keys between development, staging and production.

### Rotating a master key

1. Generate a new key: `pnpm keys:generate 20270101`.
2. Put it **first** in `DATA_ENCRYPTION_KEYS`, and keep the old key after it: `20270101:…,20261126:…`. Deploy. New values use the new key; old values still decrypt with the old one.
3. Re-encrypt existing values with the new key (a one-off job, to be added with the first encrypted model).
4. When no value references the old key id, remove it from the list and deploy.

**If a key may have leaked,** treat it as an incident: rotate immediately, run the re-encryption, then remove the old key.

## Audit log

`audit_log` records who viewed or changed sensitive data: reads of health profiles, plan approvals, money movements.

- **Recording.** In the API, add `@Audited({ action: 'health_profile.viewed', entityType: 'health_profile' })` to a route, or call `AuditService.record(...)`, passing the transaction when the entry describes a change. Auditing fails closed: if the entry can't be written, the request fails.
- **What goes in.** The actor, action, entity, request id, and non-sensitive context in `metadata`. **Never put health details or phone numbers in `metadata`.**
- **Append-only.** A database trigger refuses `UPDATE` and `TRUNCATE` on `audit_log`, and refuses `DELETE` except for retention purges. This holds whichever database user connects.
- **Retention purge.** Entries older than two years may be deleted, inside a transaction that first runs `SELECT set_config('app.audit_purge', 'on', true)`. Newer rows can't be deleted even then.

## Logs

The API and worker remove credentials, phone numbers and health details from log lines (`LOG_REDACT_PATHS` in `@dyjext/shared`). Redaction matches field names, so keep those names consistent, and don't log whole request bodies or database rows that may hold health data.
