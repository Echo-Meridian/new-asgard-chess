/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Configure headers for Worker and WASM files
  async headers() {
    return [
      {
        source: '/stockfish/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },
  
  // Add experimental configuration for Turbopack
  experimental: {
    // Apply optimization for Turbopack
    turbo: {
      resolveAlias: {
        // Help Turbopack find Worker files
        'stockfish': '/public/stockfish'
      }
    }
  }
};

module.exports = nextConfig;