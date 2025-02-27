/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'offlineCache',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
  ],
})

module.exports = withPWA({
  // Performance and optimization
  reactStrictMode: true,
  
  // Image optimization
  images: {
    domains: [], // Add domains for external images if needed
    formats: ['image/webp'],
  },
  
  // Build configuration
  swcMinify: true, // Use SWC for minification (faster than Terser)
  
  // Environment variables exposed to the browser
  env: {
    GAME_VERSION: '1.0.0',
    GAME_NAME: 'Asgard Chess',
  },
  
  // For chess game, you might want to ensure all assets are cached
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
  
  // For better performance
  poweredByHeader: false,
})