import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Ticket, User } from "lucide-react";

// Cache de 1 hora para as configurações do sistema no servidor
export const revalidate = 3600; 

const inter = Inter({ subsets: ["latin"] });

async function getConfig() {
  try {
    const { data, error } = await supabase
      .from('vw_configuracoes_publicas')
      .select('*')
      .eq('id', 1)
      .single();
    
    if (error) throw error;
    return data || { nome_sistema: process.env.NEXT_PUBLIC_SITE_NAME || "Sorteios Online" };
  } catch (err) {
    console.error("Erro ao buscar configurações:", err);
    return { nome_sistema: process.env.NEXT_PUBLIC_SITE_NAME || "Sorteios Online" };
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const config = await getConfig();
  return {
    title: {
      default: config.nome_sistema,
      template: `%s | ${config.nome_sistema}`
    },
    description: "Concorra a prêmios incríveis participando de nossas rifas!",
    icons: {
      icon: config.logo_url || "/favicon.ico",
    }
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const config = await getConfig();

  return (
    <html lang="pt-BR" className="h-full">
      <body className={`${inter.className} min-h-full flex flex-col bg-gray-50`}>
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="flex items-center gap-2">
                {config.logo_url ? (
                  <img src={config.logo_url} alt={config.nome_sistema} className="h-8 w-auto object-contain" />
                ) : (
                  <Ticket className="h-6 w-6 text-blue-600" />
                )}
                {/* Nome do sistema sempre visível ao lado da logo/ícone */}
                <span className="font-bold text-lg md:text-xl text-gray-900 tracking-tight">
                  {config.nome_sistema}
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-4">
              <Link 
                href="/minhas-compras" 
                className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
              >
                <User className="h-5 w-5" />
                <span className="text-sm">Meus Números</span>
              </Link>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-grow">
          {children}
        </div>

        {/* Footer */}
        <footer className="bg-gray-900 text-gray-400 py-12 text-center text-sm">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-col items-center mb-6">
              <div className="flex items-center gap-2 mb-4 grayscale opacity-50">
                {config.logo_url ? (
                  <img src={config.logo_url} alt={config.nome_sistema} className="h-8 object-contain" />
                ) : (
                  <Ticket className="h-6 w-6 text-blue-500" />
                )}
                <span className="font-bold text-lg text-white">
                  {config.nome_sistema}
                </span>
              </div>
              
              <p className="max-w-2xl mx-auto text-xs sm:text-sm">
                Este site é destinado exclusivamente para uso de pessoas maiores de 18 anos. 
                Ao acessar e utilizar os serviços oferecidos, você confirma que possui 18 anos ou mais.
              </p>
            </div>
            
            <p className="mb-4 text-gray-500">© {new Date().getFullYear()} {config.nome_sistema}. Todos os direitos reservados.</p>
            
            <div className="flex flex-wrap justify-center gap-4 text-xs">
              <Link href="/termos" className="hover:text-white transition-colors">Termos de Uso</Link>
              <Link href="/privacidade" className="hover:text-white transition-colors">Política de Privacidade</Link>
              <Link href="/minhas-compras" className="hover:text-white transition-colors">Minhas Compras</Link>
              <a href="https://admin.rifa.virtudes.net.br" className="hover:text-white transition-colors border-l border-gray-700 pl-4 ml-4">Área Restrita</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
