import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  distDir: 'out',
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
