import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

// The web app uses Next's own ESLint config (React, hooks, accessibility, TypeScript).
// It runs on ESLint 9 because Next's plugins do not support ESLint 10 yet.
const config = [{ ignores: ['.next/**', 'next-env.d.ts'] }, ...nextVitals, ...nextTypescript];

export default config;
