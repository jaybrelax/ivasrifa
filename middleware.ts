import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware de Roteamento Universal (SEO + SPA Fallback)
 * 
 * Este arquivo é o "cérebro" das rotas no Vercel. 
 * Ele garante que F5 e links diretos funcionem sempre.
 */
export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const path = url.pathname;
  const userAgent = request.headers.get('user-agent') || '';

  // 1. Definições de segurança e exclusão
  const isApi = path.startsWith('/api');
  const isStaticFile = path.includes('.'); // Arquivos como .js, .css, .png, etc.
  
  // Rotas fixas do sistema que o React Router deve gerenciar
  const reservedRoutes = [
    '/admin',
    '/minhas-compras',
    '/sucesso',
    '/cancelado',
    '/pendente',
    '/_next',
  ];

  // Se for API ou arquivo estático, deixa o Vercel servir normalmente
  if (isApi || isStaticFile) {
    return NextResponse.next();
  }

  // 2. Se for uma das rotas reservadas do sistema (admin, etc)
  // Forçamos o carregamento do index.html para o SPA assumir
  if (reservedRoutes.some(r => path.startsWith(r))) {
    return NextResponse.rewrite(new URL('/index.html', request.url));
  }

  // 3. Se estiver na raiz exata "/", deixa a Home carregar
  if (path === '/') {
    return NextResponse.next();
  }

  // 4. Lógica de Roteamento Dinâmico (Rifas /:id na raiz)
  const botUserAgents = [
    'baiduspider', 'bingbot', 'discordapp.com', 'embedly', 'facebookexternalhit',
    'googlebot', 'linkedinbot', 'outbrain', 'pinterest', 'quora link preview', 'rogerbot',
    'showyoubot', 'slackbot', 'twitterbot', 'vkShare', 'W3C_Validator', 'whatsapp'
  ];

  const isBot = botUserAgents.some(bot => userAgent.toLowerCase().includes(bot.toLowerCase()));

  if (isBot) {
    // BOT: Desvia para a API de SEO para injetar metadados
    const rifaId = path.substring(1);
    const seoUrl = url.clone();
    seoUrl.pathname = `/api-seo/${rifaId}`;
    return NextResponse.rewrite(seoUrl);
  }

  // HUMANO: Para qualquer outra rota na raiz (que supomos ser uma rifa),
  // forçamos o carregamento do index.html. O React Router então lerá o URL e mostrará a Rifa certa.
  // Isso resolve o erro de F5 e links diretos.
  return NextResponse.rewrite(new URL('/index.html', request.url));
}

// Rodar em quase tudo, exceto arquivos estáticos óbvios
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
