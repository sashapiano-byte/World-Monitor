/** @type {import('next').NextConfig} */
const isCapacitor = process.env.BUILD_TARGET === 'capacitor';

const nextConfig = {
  reactStrictMode: true,
  // Capacitor packages a static export of the web app into the iOS shell.
  // Vercel/web builds run the full server (App Router, route handlers).
  ...(isCapacitor
    ? {
        output: 'export',
        images: { unoptimized: true },
        distDir: 'out',
      }
    : {}),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};

export default nextConfig;
