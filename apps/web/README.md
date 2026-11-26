# @dyjext/web

Next.js (App Router) app with Tailwind CSS. See `docs/ARCHITECTURE.md` §14.

| Path         | Audience                        | Status                        |
| ------------ | ------------------------------- | ----------------------------- |
| `/`          | Public                          | Landing page                  |
| `/app`       | Families (payers)               | Placeholder until #18 and #37 |
| `/ops`       | Dietitians and operations staff | Home; planner preview in #48  |
| `/v/[token]` | Vendors (from a WhatsApp link)  | Placeholder until #31         |

## Run locally

```bash
pnpm --filter @dyjext/web dev
```

The app runs on `http://localhost:3000`. Requests to `/api/*` are forwarded to the API (`API_URL`, default `http://localhost:4000`), so the browser only ever talks to one origin.

## Conventions

- **Colours** come from design tokens in `app/globals.css` (`bg-surface`, `text-text-muted`, `text-brand`, …). Dark mode follows the system setting.
- **Server components by default**; add `'use client'` only for interactive parts. Client data fetching uses React Query (`components/providers.tsx`).
- **Linting** uses Next's own ESLint config on ESLint 9, because Next's plugins don't support ESLint 10 yet. Every other package uses the shared config on ESLint 10.
