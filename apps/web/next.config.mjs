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
  // NOTE: /uploads/* is NOT a rewrite. It is a route handler, at
  // src/app/uploads/[...path]/route.ts.
  //
  // It was a rewrite, and that could not work in production: Next resolves
  // rewrites at build time and freezes them into the standalone server, while
  // API_INTERNAL_URL only exists at run time. The destination was therefore
  // baked as the fallback localhost:4000 — the web container itself — and
  // every uploaded image failed with ECONNREFUSED. Anything that has to read
  // a deployment address belongs in a request-time code path, not here.
};

export default withNextIntl(nextConfig);
