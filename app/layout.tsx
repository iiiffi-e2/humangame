import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppChrome } from '@/components/AppChrome';
import { currentPlayer } from '@/lib/auth/session';
import { publicEnv } from '@/lib/env';

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: {
    default: 'HUMAN — how human are you today?',
    template: '%s · HUMAN',
  },
  description:
    'Five events. One official run. Everyone gets the same five. Seventy-five seconds, once a day.',
  applicationName: 'HUMAN',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'HUMAN' },
  openGraph: {
    type: 'website',
    siteName: 'HUMAN',
    title: 'HOW HUMAN ARE YOU TODAY?',
    description: 'Five events. One official run. Everyone gets the same five.',
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#111111',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const player = await currentPlayer();
  const reduceMotion = player?.settings.reduceMotion ?? false;

  return (
    <html lang="en" data-reduce-motion={reduceMotion ? 'true' : 'false'}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/*
          Loaded from the CDN rather than through next/font so a build never
          depends on reaching Google. The type scale degrades gracefully:
          headline numerals measure and shrink themselves (see FitText), so a
          blocked font changes how the page looks, never whether it works.
        */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,100..900&family=JetBrains+Mono:wght@400;500;700&display=swap"
        />
      </head>
      <body>
        <a href="#main" className="sr-only">
          Skip to content
        </a>
        <AppChrome playerId={player?.id ?? null}>{children}</AppChrome>
      </body>
    </html>
  );
}
