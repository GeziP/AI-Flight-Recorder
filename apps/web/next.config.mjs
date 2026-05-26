/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@aifr/event-schema'],
  },
};

export default nextConfig;
