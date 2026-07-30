/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: {
    // Lint is run explicitly in CI (`npm run lint`); do not fail container builds on it.
    ignoreDuringBuilds: true,
  },
  experimental: {
    // `pg` is a native-ish driver: keep it out of the bundler and require it at runtime.
    serverComponentsExternalPackages: ['pg'],
  },
};

export default nextConfig;
