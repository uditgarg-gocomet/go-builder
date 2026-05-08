import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@portal/ui', '@portal/core', '@portal/action-runtime', '@portal/widgets'],
  experimental: {
    optimizePackageImports: ['@portal/ui'],
  },
}

export default nextConfig
