import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  distDir: '.next-netlify',
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
