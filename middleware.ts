import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware para lidar com SEO dinâmico e rotas na raiz.
 * Detecta se o acesso é de um Crawler (WhatsApp, Facebook, etc) 
 * e redireciona para a API de SEO. Caso contrário, permite o acesso normal da SPA.
 */
export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const path = url.pathname;
  const userAgent = request.headers.get('user-agent') || '';

  // 1. Lista de rotas que NÃO devem ser identificadas como rifas potenciais
  const excludedPrefixes = [
    '/api',
    '/admin',
    '/minhas-compras',
    '/sucesso',
    '/cancelado',
    '/pendente',
    '/assets',
    '/favicon.ico',
    '/manifest.json',
    '/robots.txt',
    '/sitemap.xml'
  ];

  // Se a rota está na lista de exclusão ou tem extensão (ex: .png, .js), não faz nada
  if (excludedPrefixes.some(p => path.startsWith(p)) || path.includes('.')) {
    return NextResponse.next();
  }

  // Se estiver na raiz "/", não faz nada (deixa a Home carregar)
  if (path === '/') {
    return NextResponse.next();
  }

  // 2. Detectar se é um Bot/Crawler de redes sociais
  const botUserAgents = [
    'baiduspider', 'bingbot', 'discordapp.com', 'embedly', 'facebookexternalhit',
    'googlebot', 'linkedinbot', 'outbrain', 'pinterest', 'quora link preview', 'rogerbot',
    'showyoubot', 'slackbot', 'twitterbot', 'vkShare', 'W3C_Validator', 'whatsapp'
  ];

  const isBot = botUserAgents.some(bot => userAgent.toLowerCase().includes(bot.toLowerCase()));

  // Se for um bot, fazemos o REWRITE interno para a API de SEO
  // O usuário não verá o URL mudar, mas o Vercel chamará a função serverless
  if (isBot) {
    const rifaId = path.substring(1); // Remove a barra inicial
    // Reescreve internamente para a nossa rota de API que gera os metadados
    const seoUrl = url.clone();
    seoUrl.pathname = `/api-seo/${rifaId}`;
    return NextResponse.rewrite(seoUrl);
  }

  // Se for um usuário real, deixa o Vercel seguir para o index.html (SPA Fallback)
  // Isso garante que o F5 funcione, pois o Vercel retornará o index.html e o React Router assume
  return NextResponse.next();
}

// Configurar em quais caminhos o middleware deve rodar
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
