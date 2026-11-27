import type { NextConfig } from 'next';

// The browser calls /api/*; Next forwards it to the API server. One origin, so no CORS
// in the browser and the API address stays a server-side setting.
const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/:path*` }];
  },
};

export default config;
