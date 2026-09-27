import path from 'node:path';
import { fileURLToPath } from 'node:url';
import createNextIntlPlugin from 'next-intl/plugin';
import { imageHosts } from './image-hosts.config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Points next-intl at the request config; without it getLocale() and the
// translation hooks have no per-request locale to read.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emits a minimal self-contained server bundle for the Docker image.
  output: 'standalone',
  // Without this, file tracing stops at apps/web and misses hoisted
  // workspace dependencies.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: imageHosts,
  },
  webpack(config) {
    // packages/shared is consumed straight from TypeScript source (see the
    // paths mapping in tsconfig.json), and its imports carry the .js
    // extensions that ESM output requires. Webpack has to be told those
    // resolve to .ts on disk.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
  // NOTE: this resolution fix is webpack-only. Running `next dev --turbo`
  // would fail to resolve @teamenergo/shared until Turbopack config lands in
  // a newer Next version, so stick to the default dev server.
  async rewrites() {
    // Uploaded media lives with the API, which is not publicly routable.
    // Proxying here means one URL shape in dev and in production, and
    // next/image caches the optimised output so the origin is hit rarely.
    const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
    return [{ source: '/uploads/:path*', destination: `${apiUrl}/uploads/:path*` }];
  },
};

export default withNextIntl(nextConfig);
