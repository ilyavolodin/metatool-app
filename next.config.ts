import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['sqlite3', 'sqlite'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = { 
        fs: false, 
        path: false,
        os: false,
        crypto: false,
      };
      
      // Exclude SQLite modules from client bundle
      config.externals = config.externals || [];
      config.externals.push({
        'sqlite3': 'commonjs sqlite3',
        'sqlite': 'commonjs sqlite',
        'bindings': 'commonjs bindings',
      });
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