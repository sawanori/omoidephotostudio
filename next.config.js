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
      'your-supabase-project.supabase.co',
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
            value: process.env.NODE_ENV === 'development' 
              ? `
                default-src 'self';
                script-src 'self' 'unsafe-inline' 'unsafe-eval';
                style-src 'self' 'unsafe-inline';
                img-src 'self' blob: data: https://*.supabase.co https://*.supabase.in;
                connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co;
              `.replace(/\s+/g, ' ').trim()
              : `
                default-src 'self';
                script-src 'self' 'wasm-unsafe-eval';
                style-src 'self' 'unsafe-inline';
                img-src 'self' blob: data: https://*.supabase.co https://*.supabase.in;
                connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co;
              `.replace(/\s+/g, ' ').trim()
          }
        ]
      }
    ];
  },
};

module.exports = nextConfig;
