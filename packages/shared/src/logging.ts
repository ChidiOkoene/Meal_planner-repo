/**
 * Paths pino removes from every log line (docs/ARCHITECTURE.md §15): credentials, phone
 * numbers and health details. Used by the API and the worker. Wildcards match one level,
 * so `*.phoneE164` covers `{ recipient: { phoneE164 } }` and `req.body.phoneE164` is listed
 * separately.
 */
export const LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  'phoneE164',
  '*.phoneE164',
  'req.body.phoneE164',
  'phone',
  '*.phone',
  'req.body.phone',
  'password',
  '*.password',
  'medicationsText',
  '*.medicationsText',
  'conditions',
  '*.conditions',
  'readings',
  '*.readings',
  'healthProfile',
  '*.healthProfile',
];
