import * as React from "react";
import { Link, Outlet } from "react-router-dom";
import { Ticket, LayoutDashboard, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/src/lib/supabase";

export default function PublicLayout() {
  const [config, setConfig] = React.useState({ 
    nome_sistema: "Sorteios Online", 
    logo_url: ""
  });
  const [user, setUser] = React.useState<any>(null);

  React.useEffect(() => {
    async function fetchConfig() {
      try {
        const { data } = await supabase
          .from('vw_configuracoes_publicas')
          .select('*')
          .eq('id', 1)
          .single();
          
        if (data) {
          setConfig({
            nome_sistema: data.nome_sistema || "Sorteios Online",
            logo_url: data.logo_url || ""
          });
        }
      } catch (err) {
        console.error("Erro ao carregar configurações do layout:", err);
      }
    }

    async function checkUser() {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user || null);
    }

    fetchConfig();
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center group">
            {config.logo_url ? (
              <img src={config.logo_url} alt={config.nome_sistema} className="h-8 object-contain mr-2 transition-transform group-hover:scale-105" />
            ) : (
              <Ticket className="h-6 w-6 text-blue-600 mr-2 transition-transform group-hover:rotate-12" />
            )}
            <span className="text-xl font-black text-gray-900 tracking-tight">{config.nome_sistema}</span>
          </Link>
          
          <div className="flex items-center gap-2">
            {/* Ícone Admin Mobile (Só aparece logado) */}
            {user && (
              <Link to="/admin" className="md:hidden flex items-center justify-center p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors mr-1">
                <LayoutDashboard className="h-6 w-6" />
              </Link>
            )}
            <nav className="flex items-center gap-1 sm:gap-2">
              <Button 
                  variant="ghost" 
                  size="sm"
                  className="font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 hover:text-blue-800 rounded-full px-3 sm:px-4"
                  render={<Link to="/minhas-compras" />} 
                  nativeButton={false}
              >
                <Ticket className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Meus Números</span>
              </Button>
              <Button 
                  size="sm" 
                  className="bg-blue-600 hover:bg-blue-700 font-bold hidden sm:flex"
                  render={<Link to="/admin" />} 
                  nativeButton={false}
              >
                {user ? "Painel Admin" : "Entrar"}
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main>
        <Outlet context={{ config }} />
      </main>
    </div>
  );
}
