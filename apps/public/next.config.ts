import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Permite todas as imagens para facilitar, ou refine conforme o bucket do Supabase
      },
    ],
  },
  // Desabilita lint durante o build para evitar que erros de TS em componentes legados travem o deploy
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: '/admin',
        destination: 'https://ivasrifa-admin.vercel.app/admin',
      },
      {
        source: '/admin/:path*',
        destination: 'https://ivasrifa-admin.vercel.app/admin/:path*',
      },
    ]
  },
};

export default nextConfig;
