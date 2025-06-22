import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('better-sqlite3');
    }
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/service/:path*',
        destination: 'https://metatool-service.jczstudio.workers.dev/:path*',
      },
    ];
  },
};

export default nextConfig;
