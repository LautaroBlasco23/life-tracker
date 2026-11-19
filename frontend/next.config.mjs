import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('./package.json', import.meta.url)),
    'utf8'
  )
);

// Turbopack infers the project root from the nearest ancestor lockfile. Locally
// the monorepo root has package-lock.json, so root is inferred as the repo root
// and ../packages/shared sits inside it. The Docker builder stage (/app) has no
// lockfile at /app, so root would be inferred as /app/frontend and every
// @shared/* import (copied to /app/packages/shared) would fall outside it and
// fail resolution. Pin the root to frontend/'s parent explicitly — the repo
// root locally, /app in Docker.
const turbopackRoot = fileURLToPath(new URL('..', import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: turbopackRoot,
  },
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
};

export default nextConfig;
