import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

const pkg = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('./package.json', import.meta.url)),
    'utf8'
  )
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  env: {
    // Single version source: frontend/package.json, bumped by release-please.
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    // Explicit aliases: TS 7 removed `baseUrl`, so tsconfig paths alone no
    // longer feed Next's webpack resolver for `@/*` and `@shared/*`.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(dir),
      '@shared': path.resolve(dir, '../packages/shared/src'),
    };
    return config;
  },
};

export default nextConfig;
