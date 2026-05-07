import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@portal/ui', '@portal/core', '@portal/action-runtime'],
  experimental: {
    optimizePackageImports: ['@portal/ui'],
  },
  // Allow ESM-style ".js" suffixes on relative imports to resolve to the
  // underlying .ts/.tsx source. Matches tsconfig's moduleResolution: "bundler"
  // behaviour so Webpack and tsc agree on resolution.
  webpack(config) {
    config.resolve ??= {}
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    }
    return config
  },
}

export default nextConfig
