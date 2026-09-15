import os from 'node:os';
import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';

/**
 * Hostnames Next's dev server will accept besides localhost.
 *
 * Opening the Network URL (`http://192.168.x.x:3000`) sends Origin as that
 * LAN address. Next 16 then 403s `/_next` module scripts unless the host is
 * listed here, which leaves /play stuck on its SSR "Fetching…" shell.
 */
function lanDevOrigins(): string[] {
  const hosts = new Set<string>(['127.0.0.1', os.hostname(), '*.local']);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    try {
      hosts.add(new URL(siteUrl).hostname);
    } catch {
      // Ignore a malformed public URL; the rest of the list still works.
    }
  }
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.internal) continue;
      const host = addr.address.split('%')[0];
      if (host) hosts.add(host);
    }
  }
  return [...hosts];
}

const nextConfig: NextConfig = {
  allowedDevOrigins: lanDevOrigins(),
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['date-fns'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
