import * as React from "react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  Home, 
  Ticket, 
  MessageSquare, 
  User, 
  LayoutDashboard, 
  ShoppingBag,
  Trophy
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  external?: boolean;
  color: string;
}

export function MobileNav() {
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");

  React.useEffect(() => {
    setIsAdmin(location.pathname.startsWith("/admin"));

    async function fetchConfig() {
      const { data } = await supabase
        .from('configuracoes')
        .select('whatsapp')
        .eq('id', 1)
        .single();
      if (data?.whatsapp) setWhatsapp(data.whatsapp);
    }
    fetchConfig();
  }, [location.pathname]);

  const publicItems: NavItem[] = [
    { label: "Início", icon: Home, path: "/", color: "#6366f1" },
    { label: "Compras", icon: Ticket, path: "/minhas-compras", color: "#3b82f6" },
    { label: "Suporte", icon: MessageSquare, path: `https://wa.me/${whatsapp.replace(/\D/g, '')}`, external: true, color: "#10b981" },
    { label: "Admin", icon: User, path: "/admin", color: "#8b5cf6" },
  ];

  const adminItems: NavItem[] = [
    { label: "Painel", icon: LayoutDashboard, path: "/admin", color: "#8b5cf6" },
    { label: "Rifas", icon: Ticket, path: "/admin/rifas", color: "#3b82f6" },
    { label: "Ranking", icon: Trophy, path: "/admin/ranking", color: "#f59e0b" },
    { label: "Pedidos", icon: ShoppingBag, path: "/admin/pedidos", color: "#10b981" },
  ];

  const items = isAdmin ? adminItems : publicItems;

  return (
    <div
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-3 py-2 safe-area-bottom"
      style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(99,102,241,0.1)',
        boxShadow: '0 -4px 24px rgba(99,102,241,0.08)',
      }}
    >
      <nav className="flex items-center justify-around">
        {items.map((item) => {
          const isActive = isAdmin
            ? (item.path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(item.path))
            : location.pathname === item.path;

          if (item.external) {
            return (
              <a
                key={item.label}
                href={item.path}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 group py-1 px-2"
              >
                <div className="p-1.5 rounded-xl text-slate-400 group-active:scale-95 transition-transform">
                  <item.icon size={20} />
                </div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">
                  {item.label}
                </span>
              </a>
            );
          }

          return (
            <Link
              key={item.label}
              to={item.path}
              className="flex flex-col items-center gap-1 group py-1 px-2 active:scale-95 transition-transform"
            >
              <div
                className={cn(
                  "p-1.5 rounded-xl transition-all duration-200",
                  isActive ? "shadow-md" : "text-slate-400"
                )}
                style={isActive ? { background: item.color, color: '#fff', boxShadow: `0 4px 12px ${item.color}40` } : {}}
              >
                <item.icon size={20} className={isActive ? "text-white" : ""} />
              </div>
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-tight transition-colors",
                  isActive ? "text-slate-800" : "text-slate-400"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
