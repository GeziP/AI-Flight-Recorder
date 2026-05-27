/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  distDir: '.next',
  experimental: {
    serverComponentsExternalPackages: ['@aifr/event-schema'],
  },
};

export default nextConfig;
