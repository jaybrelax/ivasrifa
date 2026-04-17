import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '../../', ''); // Busca o .env na raiz do monorepo
  
  return {
    base: '/',
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'ivas_icon_192.png', 'ivas_icon_512.png'],
        manifest: {
          name: 'Portal IVAS - Admin',
          short_name: 'IVAS Admin',
          description: 'Painel Administrativo do Sistema de Rifas IVAS',
          theme_color: '#ffffff',
          start_url: '/admin',
          display: 'standalone',
          icons: [
            {
              src: 'ivas_icon_192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'ivas_icon_512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      // Adiciona variáveis do Supabase se necessário para o build
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      commonjsOptions: {
        include: [/packages\/shared/, /node_modules/],
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
