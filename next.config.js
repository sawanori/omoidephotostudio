/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'crgswbpgbxvtrszimnmk.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    domains: [
      'images.unsplash.com',
      'crgswbpgbxvtrszimnmk.supabase.co',
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://vercel.live;
              style-src 'self' 'unsafe-inline';
              img-src 'self' blob: data: https://*.supabase.co https://*.supabase.in;
              connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://vercel.live;
              frame-src 'self' https://vercel.live;
            `.replace(/\s+/g, ' ').trim()
          }
        ]
      }
    ];
  },
};

module.exports = nextConfig;
