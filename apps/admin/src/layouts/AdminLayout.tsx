import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Ticket,
  Users,
  Settings,
  LogOut,
  Menu,
  ShoppingCart,
  UserCircle,
  Trophy,
  User,
  Eye,
  X,
  Shield,
  Bell,
  Sun,
  Moon,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { cn } from "@/lib/utils";
import { MobileNav } from '@/components/MobileNav';
import { InstallPWA } from '@/components/InstallPWA';
import { useQueryClient } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';

export default function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const location = useLocation();
  const navigate = useNavigate();
  const [config, setConfig] = useState<any>({ nome_sistema: 'Rifa Online', logo_url: '', admin_dark_mode: false });
  const [session, setSession] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'guardiao'>('admin');
  const [vendedorData, setVendedorData] = useState<any>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const [localTheme, setLocalTheme] = useState<'light' | 'dark' | null>(() => {
    return localStorage.getItem('theme_preference') as 'light' | 'dark' | null;
  });

  const { isInstallable, installPWA } = usePWAInstall();

  const isDarkMode = localTheme === 'dark' || (localTheme === null && config.admin_dark_mode);

  const toggleTheme = () => {
    const newTheme = isDarkMode ? 'light' : 'dark';
    setLocalTheme(newTheme);
    localStorage.setItem('theme_preference', newTheme);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    }
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  useEffect(() => {
    // Timeout de segurança: Se não carregar em 3 segundos, libera o loader
    const securityTimeout = setTimeout(() => {
      if (loadingAuth) {
        console.warn('Auth Timeout: Forçando saída do loader.');
        setLoadingAuth(false);
      }
    }, 3000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(securityTimeout);
      setSession(session);
      setLoadingAuth(false);
      if (session) checkUserRole(session.user.id);
    }).catch(err => {
      clearTimeout(securityTimeout);
      console.error('Erro ao buscar sessão:', err);
      setLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth Event:', event, session?.user?.email);
      setSession(session);
      if (session) {
        checkUserRole(session.user.id);
      } else {
        // Se deslogou sem querer, vamos forçar o redirecionamento se não for login
        if (location.pathname !== '/login' && location.pathname !== '/recrutamento') {
          console.warn('Sessão perdida. Redirecionando para login.');
          navigate('/login');
        }
      }
    });

    return () => {
      clearTimeout(securityTimeout);
      subscription.unsubscribe();
    }
  }, []);

  async function checkUserRole(userId: string) {
    try {
      const { data } = await supabase.from('vendedores').select('*').eq('user_id', userId).maybeSingle();
      if (data) { 
        setUserRole(data.is_admin === false ? 'guardiao' : 'admin'); 
        setVendedorData(data); 
      }
      else { 
        setUserRole('admin'); 
        setVendedorData(null); 
      }
    } catch (err) { console.error('Erro ao checar role:', err); }
  }

  useEffect(() => {
    async function fetchConfig() {
      try {
        const { data } = await supabase.from('configuracoes').select('*').eq('id', 1).single();
        if (data) setConfig({ nome_sistema: data.nome_sistema || 'Rifa Online', logo_url: data.logo_url || '', admin_dark_mode: data.admin_dark_mode || false });
      } catch (error) { console.error('Erro ao buscar config:', error); }
    }
    fetchConfig();
  }, [location.pathname]);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

    // PWA Isolation para Painel Administrativo
    useEffect(() => {
    const manifestUrl = '/admin-manifest.json';
    let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
    
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    // Apenas insere e modifica se for a URL certa para prevenir sobrecarga global.
    if (manifestLink.href !== location.origin + manifestUrl) {
      manifestLink.href = manifestUrl;
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/admin-sw.js').then(
        (reg) => {
          console.log('PWA Admin SW ativado:', reg.scope);
          // O navegador agora respeita os headers do servidor para checar updates.
          reg.update();
        },
        (err) => console.error('PWA Admin SW falhou:', err)
      );
    }
  }, []);

  const queryClient = useQueryClient();

  // Realtime updates for orders and stats
  useEffect(() => {
    const channel = supabase
      .channel('pedido-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pedidos',
        },
        (payload) => {
          console.log('Realtime update:', payload);
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
          queryClient.invalidateQueries({ queryKey: ['pedidos-list'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);


  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const allNavItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/', roles: ['admin', 'guardiao'], color: 'text-violet-500 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/30', activeBg: 'bg-violet-600' },
    { icon: Ticket, label: 'Rifas', path: '/rifas', roles: ['admin', 'guardiao'], color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30', activeBg: 'bg-blue-600' },
    { icon: Trophy, label: 'Ranking', path: '/ranking', roles: ['admin', 'guardiao'], color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', activeBg: 'bg-amber-500' },
    { icon: ShoppingCart, label: 'Vendas', path: '/vendas', roles: ['admin', 'guardiao'], color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', activeBg: 'bg-emerald-600' },
    { icon: Shield, label: 'Guardiões', path: '/vendedores', roles: ['admin'], color: 'text-indigo-500 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/30', activeBg: 'bg-indigo-600' },
    { icon: UserCircle, label: 'Meu Perfil', path: '/perfil', roles: ['admin', 'guardiao'], color: 'text-pink-500 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-950/30', activeBg: 'bg-pink-600' },
    { icon: Settings, label: 'Configurações', path: '/configuracoes', roles: ['admin'], color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800/30', activeBg: 'bg-slate-600' },
  ];

  const navItems = allNavItems.filter(item => item.roles.includes(userRole));

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-50 dark:from-slate-900 dark:to-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200 animate-pulse">
            <Ticket className="h-6 w-6 text-white" />
          </div>
          <div className="w-6 h-6 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  const forbiddenPaths = ['/vendedores', '/configuracoes'];
  const isForbidden = forbiddenPaths.some(path => location.pathname.startsWith(path));
  if (userRole === 'guardiao' && isForbidden) return <Navigate to="/" replace />;

  const displayName = vendedorData?.nome || (userRole === 'admin' ? 'Administrador' : 'Guardião');
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="h-screen w-full flex overflow-hidden bg-background text-foreground">

      {/* Overlay Mobile */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ─── SIDEBAR ─── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 w-[260px] bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950/50 border-r border-indigo-500/10 dark:border-slate-800 shadow-lg shadow-indigo-500/5 dark:shadow-none ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="h-[70px] flex items-center justify-between px-6 shrink-0 border-b border-indigo-500/5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center justify-center shrink-0",
              !config.logo_url ? "w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 shadow-md shadow-blue-200" : "h-10"
            )}>
              {config.logo_url
                ? <img src={config.logo_url} alt={config.nome_sistema} className="h-10 w-auto object-contain" />
                : <Ticket className="h-5 w-5 text-white" />
              }
            </div>
            <span className="text-[15px] font-black text-slate-800 dark:text-slate-200 tracking-tight truncate max-w-[140px]">
              {config.nome_sistema}
            </span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* User Card */}
        <div className="mx-4 mt-5 mb-2 p-4 rounded-2xl flex items-center gap-3 bg-gradient-to-br from-indigo-50/50 to-blue-50/50 dark:from-slate-800/50 dark:to-slate-900/50 border border-indigo-500/10 dark:border-slate-800/80">
          <div className="relative shrink-0">
            <Avatar className="h-11 w-11 ring-2 ring-white dark:ring-slate-800 shadow-md">
              <AvatarImage src={vendedorData?.avatar_url} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-violet-600 text-white font-bold text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-white dark:border-slate-800 rounded-full" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200 truncate">{displayName}</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{session.user.email}</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-3 mb-3">Menu</p>
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={() => { if (window.innerWidth < 1024) setIsSidebarOpen(false); }}
                    className={cn(
                      "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200",
                      isActive
                        ? "text-white bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 shadow-md shadow-indigo-500/20 dark:shadow-none"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800/40 hover:shadow-sm"
                    )}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                      isActive ? 'bg-white/20' : `${item.bg} group-hover:scale-110`
                    }`}>
                      <item.icon className={`h-4 w-4 ${isActive ? 'text-white' : item.color}`} />
                    </div>
                    {item.label}
                    {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* View Site + Logout */}
        <div className="p-4 space-y-2 shrink-0 border-t border-indigo-500/5 dark:border-slate-800">
          <a
            href={`https://rifa.virtudes.net.br${vendedorData?.codigo_ref ? `?ref=${vendedorData.codigo_ref}` : ''}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-colors">
              <Eye className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            </div>
            Ver Site Público
          </a>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center group-hover:bg-red-50 dark:group-hover:bg-red-950/30 transition-colors">
              <LogOut className="h-4 w-4 group-hover:text-red-500 dark:group-hover:text-red-400" />
            </div>
            Sair
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-0">

        {/* Header */}
        <header
          className="h-[70px] flex items-center justify-between px-5 sm:px-7 shrink-0 z-30 relative bg-white/95 dark:bg-slate-900/95 border-b border-indigo-500/5 dark:border-slate-700/50 shadow-sm transition-colors duration-200"
        >
          {/* Left: Hamburger + Title */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Logo Mobile */}
            <div className="flex items-center gap-2.5 lg:hidden">
              <div className={cn(
                "flex items-center justify-center shrink-0",
                !config.logo_url ? "w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 shadow" : "h-8"
              )}>
                {config.logo_url
                  ? <img src={config.logo_url} alt="" className="h-8 w-auto object-contain" />
                  : <Ticket className="h-4 w-4 text-white" />
                }
              </div>
              <span className="text-sm font-black text-slate-800 dark:text-slate-200 truncate max-w-[130px]">
                {config.nome_sistema}
              </span>
            </div>

            {/* Breadcrumb Desktop */}
            <div className="hidden lg:flex items-center gap-2">
              <span className="text-[13px] font-medium text-slate-400 dark:text-slate-500">
                {userRole === 'admin' ? 'Painel Administrativo' : 'Portal do Guardião'}
              </span>
              <span className="text-slate-200 dark:text-slate-800">·</span>
              <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">
                {navItems.find(i => i.path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(i.path))?.label || 'Dashboard'}
              </span>
            </div>
          </div>

          {/* Right: Actions + Avatar */}
          <div className="flex items-center gap-2">
            {/* Profile Menu Container */}
            <div className="relative" ref={menuRef}>
              <div
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200",
                  isProfileMenuOpen ? "bg-slate-100 dark:bg-slate-800" : ""
                )}
              >
                <div className="text-right">
                  <p className="text-[12px] font-bold text-slate-800 dark:text-slate-200 leading-none">{displayName.split(' ')[0]}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 capitalize">{userRole}</p>
                </div>
                <Avatar className="h-8 w-8 ring-2 ring-white dark:ring-slate-800 shadow">
                  <AvatarImage src={vendedorData?.avatar_url} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-violet-600 text-white text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Floating Menu */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 z-50 animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
                  <div className="liquid-glass-menu rounded-2xl py-2">
                    <div className="px-4 py-2 mb-1 sm:hidden border-b border-slate-200/20 dark:border-slate-800/40">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{displayName}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{session.user.email}</p>
                    </div>
                    <Link
                      to="/perfil"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors"
                    >
                      <UserCircle className="h-4 w-4" />
                      Meu Perfil
                    </Link>
                    {userRole === 'admin' && (
                      <Link
                        to="/configuracoes"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors"
                      >
                        <Settings className="h-4 w-4" />
                        Configurações
                      </Link>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTheme();
                      }}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        Tema {isDarkMode ? 'Claro' : 'Escuro'}
                      </div>
                    </button>
                    {isInstallable && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          installPWA();
                          setIsProfileMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors"
                      >
                        <Download className="h-4 w-4" />
                        Instalar App
                      </button>
                    )}
                    <div className="h-px bg-slate-200/20 dark:bg-slate-800/40 my-1 mx-2" />
                    <button
                      onClick={() => { setIsProfileMenuOpen(false); handleLogout(); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Sair
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Banner PWA Mobile */}
        <InstallPWA />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <MobileNav userRole={userRole} />
    </div>
  );
}
