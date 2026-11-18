import type { NextConfig } from 'next';

const devAllowedHosts = (process.env.DEV_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: 'security',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'btu.edu.ge',
      },
    ],
  },
};

nextConfig.allowedDevOrigins = devAllowedHosts;

nextConfig.serverExternalPackages = [
    '@payloadcms/db-postgres',
    '@payloadcms/drizzle',
    'drizzle-kit',
    'esbuild',
    '@esbuild/linux-x64',
];

// The PDF generator reads these files by computed path, which file tracing cannot see.
nextConfig.outputFileTracingIncludes = {
  '/api/webhook': ['./assets/**/*'],
  '/api/passports/[verificationId]': ['./assets/**/*'],
  '/dashboard': ['./assets/**/*'],
};

export default nextConfig;