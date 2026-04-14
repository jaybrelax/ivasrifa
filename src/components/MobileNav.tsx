import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  Home, 
  Ticket, 
  MessageSquare, 
  User, 
  LayoutDashboard, 
  ShoppingBag,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/src/lib/supabase";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  external?: boolean;
}

export function MobileNav() {
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");

  React.useEffect(() => {
    // Check if path is admin
    setIsAdmin(location.pathname.startsWith("/admin"));

    // Fetch WhatsApp from config
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
    { label: "Início", icon: Home, path: "/" },
    { label: "Compras", icon: Ticket, path: "/minhas-compras" },
    { label: "Suporte", icon: MessageSquare, path: `https://wa.me/${whatsapp.replace(/\D/g, '')}`, external: true },
    { label: "Admin", icon: User, path: "/admin" },
  ];

  const adminItems: NavItem[] = [
    { label: "Painel", icon: LayoutDashboard, path: "/admin" },
    { label: "Rifas", icon: Ticket, path: "/admin/rifas" },
    { label: "Pedidos", icon: ShoppingBag, path: "/admin/pedidos" },
    { label: "Perfil", icon: User, path: "/admin/perfil" },
  ];

  const items = isAdmin ? adminItems : publicItems;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-950 border-t border-zinc-800 px-2 py-3 safe-area-bottom">
      <nav className="flex items-center justify-around">
        {items.map((item) => {
          const isActive = location.pathname === item.path;
          
          if (item.external) {
            return (
              <a
                key={item.label}
                href={item.path}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 group"
              >
                <div className="p-1 rounded-full text-zinc-400 group-active:scale-95 transition-transform">
                  <item.icon size={22} />
                </div>
                <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-tighter">
                  {item.label}
                </span>
              </a>
            );
          }

          return (
            <Link
              key={item.label}
              to={item.path}
              className="flex flex-col items-center gap-1 group"
            >
              <div className={cn(
                "p-1 rounded-full transition-all duration-300 group-active:scale-95",
                isActive ? "text-blue-500" : "text-zinc-400"
              )}>
                <item.icon size={22} className={cn(isActive && "drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]")} />
              </div>
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-tighter transition-colors",
                isActive ? "text-blue-500" : "text-zinc-500"
              )}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute -bottom-1 w-1 h-1 bg-blue-500 rounded-full shadow-[0_0_8px_#3b82f6]" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

// Add a helper for useState since I used it but didn't import and React.* prefix is safer or import it
import { useState } from "react";
