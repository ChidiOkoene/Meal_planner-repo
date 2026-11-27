// Print a new master key entry for DATA_ENCRYPTION_KEYS.
// Usage: pnpm keys:generate [key-id]   (default id: today's date, e.g. 20261126)
import { generateKeyEntry } from '../src/encryption/envelope.js';

const id =
  process.argv.slice(2).find((a) => a !== '--') ??
  new Date().toISOString().slice(0, 10).replaceAll('-', '');
console.log(generateKeyEntry(id));
