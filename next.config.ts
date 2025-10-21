import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for smaller deployments
  output: 'standalone',

  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  // Reduce build time
  typescript: {
    // Don't fail build on type errors (run separately in CI)
    ignoreBuildErrors: false,
  },

  eslint: {
    // Don't fail build on lint errors (run separately in CI)
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
