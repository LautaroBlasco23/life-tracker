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

// Dev only (fast lane `make dev`): `next dev` has no nginx to serve the S3
// emulator's image bucket same-origin, and the emulator rejects cross-origin
// browser image fetches, so embedded note images 404. Proxy the bucket path
// through the dev server to the s3-pipe bridge (plain HTTP, published on
// host loopback by the aws-emulator compose profile). Guarded by NODE_ENV:
// rewrites are incompatible with `output: 'export'`, and `next build` runs
// with NODE_ENV=production, so the static export is unaffected.
if (process.env.NODE_ENV === 'development') {
  nextConfig.rewrites = async () => [
    {
      source: '/lifetracker-images/:path*',
      destination: 'http://127.0.0.1:9298/lifetracker-images/:path*',
    },
  ];
}

export default nextConfig;
