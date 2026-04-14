import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Ticket, 
  Users, 
  Settings, 
  LogOut,
  Menu,
  ShoppingCart,
  UserCircle
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/src/lib/supabase';
import { MobileNav } from '@/src/components/MobileNav';

export default function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
  const location = useLocation();
  const navigate = useNavigate();
  const [config, setConfig] = useState<any>({ nome_sistema: "Rifa Online", logo_url: "", admin_dark_mode: false });
  const [session, setSession] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'guardiao'>('admin');
  const [vendedorData, setVendedorData] = useState<any>(null);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingAuth(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        checkUserRole(session.user.id);
      }
    });

    // Initial role check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        checkUserRole(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkUserRole(userId: string) {
    try {
      const { data, error } = await supabase
        .from('vendedores')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (data) {
        setUserRole('guardiao');
        setVendedorData(data);
      } else {
        setUserRole('admin');
        setVendedorData(null);
      }
    } catch (err) {
      console.error("Erro ao checar role:", err);
    }
  }

  useEffect(() => {
    async function fetchConfig() {
      try {
        const { data } = await supabase
          .from('configuracoes') // Usar a tabela real para pegar admin_dark_mode
          .select('*')
          .eq('id', 1)
          .single();
          
        if (data) {
          setConfig({
            nome_sistema: data.nome_sistema || "Rifa Online",
            logo_url: data.logo_url || "",
            admin_dark_mode: data.admin_dark_mode || false
          });
        }
      } catch (error) {
        console.error("Erro ao buscar config:", error);
      }
    }
    fetchConfig();
  }, [location.pathname]); // Atualizar quando muda a rota para garantir sincronia se vier da config

  // Efeito para aplicar Dark Mode
  useEffect(() => {
    if (config.admin_dark_mode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [config.admin_dark_mode]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login');
  };

  const allNavItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin', roles: ['admin', 'guardiao'] },
    { icon: Ticket, label: 'Rifas', path: '/admin/rifas', roles: ['admin'] },
    { icon: ShoppingCart, label: 'Pedidos', path: '/admin/pedidos', roles: ['admin'] },
    { icon: Users, label: 'Vendedores', path: '/admin/vendedores', roles: ['admin'] },
    { icon: UserCircle, label: 'Meu Perfil', path: '/admin/perfil', roles: ['guardiao'] },
    { icon: Settings, label: 'Configurações', path: '/admin/configuracoes', roles: ['admin'] },
  ];

  const navItems = allNavItems.filter(item => item.roles.includes(userRole));

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="h-screen w-full bg-background flex overflow-hidden">
      
      {/* Overlay Mobile */}
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
 
      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 bg-card w-64 border-r border-border flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-border shrink-0">
          <div className="flex items-center">
            {config.logo_url ? (
              <img src={config.logo_url} alt={config.nome_sistema} className="h-8 object-contain mr-2" />
            ) : (
              <Ticket className="h-6 w-6 text-blue-600 mr-2 shrink-0" />
            )}
            <span className="text-xl font-bold text-foreground line-clamp-1" title={config.nome_sistema}>
              {config.nome_sistema}
            </span>
          </div>
          {/* Botão de fechar só no mobile dentro do sidebar */}
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
        
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-3">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || 
                               (item.path !== '/admin' && location.pathname.startsWith(item.path));
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={() => {
                      if (window.innerWidth < 768) setIsSidebarOpen(false);
                    }}
                    className={`flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                      isActive 
                        ? 'bg-primary text-primary-foreground' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <item.icon className={`h-5 w-5 mr-3 shrink-0 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center mb-4">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="bg-muted text-muted-foreground font-bold">
                {session.user.email?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-medium text-foreground truncate">
                {userRole === 'admin' ? 'Administrador' : (vendedorData?.nome || 'Guardião')}
              </p>
              <p className="text-xs text-muted-foreground truncate" title={session.user.email}>
                {session.user.email}
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="w-full justify-start text-red-600 dark:text-red-400 border-slate-200 dark:border-slate-800 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
          >
            <LogOut className="mr-2 h-4 w-4 shrink-0" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        <header className="h-16 bg-card border-b border-border flex items-center px-4 sm:px-6 shrink-0">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="md:hidden p-2 -ml-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
          >
            <span className="sr-only">Abrir menu</span>
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
          <div className="flex-1 flex justify-end">
            {/* Header actions */}
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground hidden sm:inline-block">
                {userRole === 'admin' ? 'Modo Global' : 'Painel do Guardião'}
              </span>
            </div>
          </div>
        </header>
 
        <main className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </div>
  );
}
