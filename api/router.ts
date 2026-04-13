import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';

/**
 * Router Inteligente para SPA (Vite) + SEO
 * Este arquivo resolve o erro de F5 e links diretos no Vercel.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url || '/';
  const pathName = url.split('?')[0];
  const userAgent = req.headers['user-agent'] || '';

  // 1. Detecção de Bots para SEO
  const botUserAgents = [
    'baiduspider', 'bingbot', 'discordapp.com', 'embedly', 'facebookexternalhit',
    'googlebot', 'linkedinbot', 'outbrain', 'pinterest', 'quora link preview', 'rogerbot',
    'showyoubot', 'slackbot', 'twitterbot', 'vkShare', 'W3C_Validator', 'whatsapp'
  ];

  const isBot = botUserAgents.some(bot => userAgent.toLowerCase().includes(bot.toLowerCase()));

  // Se for um bot e estiver tentando acessar uma página dinâmica (não a home e não arquivos)
  if (isBot && pathName !== '/' && !pathName.includes('.')) {
    const rifaId = pathName.substring(1);
    // Redireciona internamente para a API de SEO
    return res.redirect(`/api-seo/${rifaId}`);
  }

  // 2. Fallback para Humanos (Navegador)
  // Servimos o index.html original. O React Router no frontend lerá a URL e mostrará a página correta.
  try {
    // No Vercel, o index.html gerado pelo build fica na raiz do projeto ou em /dist
    // Geralmente acessível via process.cwd()
    const indexPath = path.join(process.cwd(), 'index.html');
    
    if (fs.existsSync(indexPath)) {
      const html = fs.readFileSync(indexPath, 'utf8');
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate');
      return res.status(200).send(html);
    } else {
      // Se não achar na raiz, tenta na pasta dist (caso o build tenha acabado de rodar)
      const distPath = path.join(process.cwd(), 'dist', 'index.html');
      if (fs.existsSync(distPath)) {
        const html = fs.readFileSync(distPath, 'utf8');
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);
      }
    }
    
    return res.status(404).send('SPA index.html not found. Check build configuration.');
  } catch (error) {
    console.error('[Router] Erro ao servir index.html:', error);
    return res.status(500).send('Erro interno ao carregar a página.');
  }
}
