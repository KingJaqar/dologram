import type { NextConfig } from 'next';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const diagnostics = process.env.NODE_ENV === 'production'
  ? './src/features/diagnostics/Unavailable.tsx'
  : './src/features/diagnostics/SharedDiagnostics.tsx';

const { version } = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8')) as { version: string };

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@dologram/shared'],
  turbopack: {
    root: resolve(import.meta.dirname, '../..'),
    resolveAlias: { '@development-diagnostics': diagnostics },
  },
  webpack(configuration) {
    configuration.resolve.alias['@development-diagnostics'] = resolve(import.meta.dirname, diagnostics);
    return configuration;
  },
  // Keep vendor source comments out of deployable maps; scan all emitted output unchanged.
  enablePrerenderSourceMaps: false,
  experimental: { serverSourceMaps: false },
  env: {
    NEXT_PUBLIC_DG_BUILD: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
    // About (WEB-14): the installed workspace version, embedded at build time like the build string.
    NEXT_PUBLIC_DG_VERSION: version,
  },
};

export default config;
