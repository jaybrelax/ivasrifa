import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Ticket, 
  Trophy,
  ShoppingCart,
  Settings,
  UserCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  color: string;
}

export function MobileNav({ userRole }: { userRole?: 'admin' | 'guardiao' }) {
  const location = useLocation();

  const adminItems: NavItem[] = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/", color: "text-violet-500" },
    { label: "Rifas", icon: Ticket, path: "/rifas", color: "text-blue-500" },
    { label: "Ranking", icon: Trophy, path: "/ranking", color: "text-amber-500" },
    { label: "Pedidos", icon: ShoppingCart, path: "/pedidos", color: "text-emerald-500" },
  ];

  // Adicionar o 5º item dinâmico
  if (userRole === 'admin') {
    adminItems.push({ label: "Config.", icon: Settings, path: "/configuracoes", color: "text-slate-400" });
  } else {
    adminItems.push({ label: "Perfil", icon: UserCircle, path: "/perfil", color: "text-pink-500" });
  }

  return (
    <div
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-2 py-3 safe-area-bottom"
      style={{
        background: '#020617', // Slate 950
        borderTop: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '0 -10px 30px rgba(0,0,0,0.5)',
      }}
    >
      <nav className="flex items-center justify-around">
        {adminItems.map((item) => {
          const isActive = item.path === '/' 
            ? location.pathname === '/' 
            : location.pathname.startsWith(item.path);

          const iconColorClass = item.color;
          
          return (
            <Link
              key={item.label}
              to={item.path}
              className="flex flex-col items-center gap-1 group relative min-w-[64px]"
            >
              <div
                className={cn(
                  "relative w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300",
                  isActive ? "scale-110" : "text-slate-500 hover:text-slate-300"
                )}
              >
                {isActive && (
                  <div 
                    className={cn("absolute inset-0 rounded-full opacity-20 animate-in fade-in zoom-in duration-300", 
                    iconColorClass.replace('text-', 'bg-'))}
                  />
                )}
                
                <item.icon 
                  size={18} 
                  className={cn(
                    "transition-all duration-300",
                    isActive ? item.color : "text-slate-500"
                  )} 
                />
              </div>
              <span
                className={cn(
                  "text-[11px] font-bold tracking-tight transition-colors duration-300",
                  isActive ? "text-white" : "text-slate-500"
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
