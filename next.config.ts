import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ⚠️ დამატებული კონფიგურაცია BTU-ს ლოგოსთვის
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'btu.edu.ge',
      },
    ],
  },
};

nextConfig.allowedDevOrigins = [
    '192.168.100.199',
    '1cbf9addba4270.lhr.life',
];

nextConfig.serverExternalPackages = [
    '@payloadcms/db-postgres',
    '@payloadcms/drizzle',
    'drizzle-kit',
    'esbuild',
    '@esbuild/linux-x64',
];

export default nextConfig;