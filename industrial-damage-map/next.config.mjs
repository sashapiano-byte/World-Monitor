import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // This project is a self-contained directory inside a repository that has its
  // own lockfile at the root. Without this, Next infers the parent as the
  // workspace root and traces the wrong tree into the standalone bundle.
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
  eslint: {
    // Lint is run explicitly in CI (`npm run lint`); do not fail container builds on it.
    ignoreDuringBuilds: true,
  },
  // `pg` is a native-ish driver: keep it out of the bundler and require it at runtime.
  serverExternalPackages: ['pg'],
};

export default nextConfig;
