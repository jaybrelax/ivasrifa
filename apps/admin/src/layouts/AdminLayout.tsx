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
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { cn } from "@/lib/utils";
import { MobileNav } from '@/components/MobileNav';
import { InstallPWA } from '@/components/InstallPWA';
import { useQueryClient } from '@tanstack/react-query';

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
    if (config.admin_dark_mode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [config.admin_dark_mode]);

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
    { icon: LayoutDashboard, label: 'Dashboard', path: '/', roles: ['admin', 'guardiao'], color: 'text-violet-500', bg: 'bg-violet-50', activeBg: 'bg-violet-600' },
    { icon: Ticket, label: 'Rifas', path: '/rifas', roles: ['admin', 'guardiao'], color: 'text-blue-500', bg: 'bg-blue-50', activeBg: 'bg-blue-600' },
    { icon: Trophy, label: 'Ranking', path: '/ranking', roles: ['admin', 'guardiao'], color: 'text-amber-500', bg: 'bg-amber-50', activeBg: 'bg-amber-500' },
    { icon: ShoppingCart, label: 'Pedidos', path: '/pedidos', roles: ['admin', 'guardiao'], color: 'text-emerald-500', bg: 'bg-emerald-50', activeBg: 'bg-emerald-600' },
    { icon: Shield, label: 'Guardiões', path: '/vendedores', roles: ['admin'], color: 'text-indigo-500', bg: 'bg-indigo-50', activeBg: 'bg-indigo-600' },
    { icon: UserCircle, label: 'Meu Perfil', path: '/perfil', roles: ['admin', 'guardiao'], color: 'text-pink-500', bg: 'bg-pink-50', activeBg: 'bg-pink-600' },
    { icon: Settings, label: 'Configurações', path: '/configuracoes', roles: ['admin'], color: 'text-slate-500', bg: 'bg-slate-50', activeBg: 'bg-slate-600' },
  ];

  const navItems = allNavItems.filter(item => item.roles.includes(userRole));

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #fafbff 100%)' }}>
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
    <div className="h-screen w-full flex overflow-hidden" style={{ background: '#F0F4FF' }}>

      {/* Overlay Mobile */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ─── SIDEBAR ─── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          width: '260px',
          background: 'linear-gradient(180deg, #ffffff 0%, #f8faff 100%)',
          borderRight: '1px solid rgba(99,102,241,0.08)',
          boxShadow: '4px 0 24px rgba(99,102,241,0.06)',
        }}
      >
        {/* Logo */}
        <div className="h-[70px] flex items-center justify-between px-6 shrink-0" style={{ borderBottom: '1px solid rgba(99,102,241,0.08)' }}>
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
            <span className="text-[15px] font-black text-slate-800 tracking-tight truncate max-w-[140px]">
              {config.nome_sistema}
            </span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* User Card */}
        <div className="mx-4 mt-5 mb-2 p-4 rounded-2xl flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #eff3ff, #e8eeff)', border: '1px solid rgba(99,102,241,0.12)' }}>
          <div className="relative shrink-0">
            <Avatar className="h-11 w-11 ring-2 ring-white shadow-md">
              <AvatarImage src={vendedorData?.avatar_url} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-violet-600 text-white font-bold text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-slate-800 truncate">{displayName}</p>
            <p className="text-[11px] text-slate-400 truncate">{session.user.email}</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-3">Menu</p>
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={() => { if (window.innerWidth < 1024) setIsSidebarOpen(false); }}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? 'text-white shadow-lg'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-white hover:shadow-sm'
                    }`}
                    style={isActive ? {
                      background: 'linear-gradient(135deg, #2563EB, #4F46E5)',
                      boxShadow: '0 4px 14px rgba(79,70,229,0.35)',
                    } : {}}
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
        <div className="p-4 space-y-2 shrink-0" style={{ borderTop: '1px solid rgba(99,102,241,0.08)' }}>
          <a
            href={`/${vendedorData?.codigo_ref ? `?ref=${vendedorData.codigo_ref}` : ''}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <Eye className="h-4 w-4 text-blue-500" />
            </div>
            Ver Site Público
          </a>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center group-hover:bg-red-50 transition-colors">
              <LogOut className="h-4 w-4 group-hover:text-red-500" />
            </div>
            Sair
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-0">

        {/* Header */}
        <header
          className="h-[70px] flex items-center justify-between px-5 sm:px-7 shrink-0 z-30 relative"
          style={{
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(99,102,241,0.08)',
            boxShadow: '0 1px 12px rgba(99,102,241,0.06)',
          }}
        >
          {/* Left: Hamburger + Title */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
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
              <span className="text-sm font-black text-slate-800 truncate max-w-[130px]">
                {config.nome_sistema}
              </span>
            </div>

            {/* Breadcrumb Desktop */}
            <div className="hidden lg:flex items-center gap-2">
              <span className="text-[13px] font-medium text-slate-400">
                {userRole === 'admin' ? 'Painel Administrativo' : 'Portal do Guardião'}
              </span>
              <span className="text-slate-200">·</span>
              <span className="text-[13px] font-bold text-slate-700">
                {navItems.find(i => i.path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(i.path))?.label || 'Dashboard'}
              </span>
            </div>
          </div>

          {/* Right: Actions + Avatar */}
          <div className="flex items-center gap-2">
            {/* Profile Menu Container */}
            <div className="relative group">
              <div
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-slate-100 transition-all duration-200",
                  isProfileMenuOpen ? "bg-slate-100" : ""
                )}
              >
                <div className="text-right">
                  <p className="text-[12px] font-bold text-slate-800 leading-none">{displayName.split(' ')[0]}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 capitalize">{userRole}</p>
                </div>
                <Avatar className="h-8 w-8 ring-2 ring-white shadow">
                  <AvatarImage src={vendedorData?.avatar_url} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-violet-600 text-white text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Floating Menu */}
              {isProfileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsProfileMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl shadow-blue-900/10 border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
                    <div className="px-4 py-2 mb-1 sm:hidden">
                      <p className="text-xs font-bold text-slate-800">{displayName}</p>
                      <p className="text-[10px] text-slate-400 truncate">{session.user.email}</p>
                    </div>
                    <Link
                      to="/perfil"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <UserCircle className="h-4 w-4" />
                      Meu Perfil
                    </Link>
                    {userRole === 'admin' && (
                      <Link
                        to="/configuracoes"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Settings className="h-4 w-4" />
                        Configurações
                      </Link>
                    )}
                    <div className="h-px bg-slate-50 my-1 mx-2" />
                    <button
                      onClick={() => { setIsProfileMenuOpen(false); handleLogout(); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Sair
                    </button>
                  </div>
                </>
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
