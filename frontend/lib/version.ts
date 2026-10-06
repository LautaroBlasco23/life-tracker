// Single version source: next.config.mjs injects the version from
// frontend/package.json (bumped by release-please) at build time.
export const APP_VERSION: string = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0'
