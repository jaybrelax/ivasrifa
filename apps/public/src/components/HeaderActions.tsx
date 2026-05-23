"use client";

import { Ticket, Timer } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

function CountdownBanner() {
  const searchParams = useSearchParams();
  const endParam = searchParams.get("end");
  
  const [timeLeft, setTimeLeft] = useState<{ d: number, m: number, s: number } | null>(null);

  useEffect(() => {
    if (!endParam) return;
    
    let days = parseInt(endParam) || 0;
    let initialSeconds = (days * 86400) + (0 * 3600) + (29 * 60) + 59;
    
    setTimeLeft({ d: days, h: 0, m: 29, s: 59 });

    const interval = setInterval(() => {
      initialSeconds--;
      if (initialSeconds < 0) {
        clearInterval(interval);
        return;
      }
      
      const d = Math.floor(initialSeconds / 86400);
      const h = Math.floor((initialSeconds % 86400) / 3600);
      const m = Math.floor((initialSeconds % 3600) / 60);
      const s = initialSeconds % 60;
      
      setTimeLeft({ d, h, m, s });
    }, 1000);

    return () => clearInterval(interval);
  }, [endParam]);

  if (endParam && timeLeft) {
    return (
      <div className="flex flex-col items-end justify-center cursor-default group px-4 py-1.5 rounded-md shadow-md animate-gradient-bg"
           style={{
             background: 'linear-gradient(270deg, #ef4444, #f97316, #ef4444)',
             backgroundSize: '200% 200%'
           }}>
        <style>{`
          @keyframes gradientMove {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .animate-gradient-bg {
            animation: gradientMove 3s ease infinite;
          }
        `}</style>
        
        <span className="text-[10px] uppercase font-bold tracking-wider text-white/90 mb-0.5">
          Vendas se encerram em
        </span>
        <div className="flex items-baseline gap-1.5 text-white">
          <div className="flex items-baseline gap-0.5 drop-shadow-sm">
            <span className="font-black text-lg sm:text-xl leading-none">{timeLeft.d}</span>
            <span className="font-medium tracking-tighter text-xs sm:text-sm text-white/90">Dias</span>
          </div>
          <div className="flex items-baseline gap-0.5 drop-shadow-sm">
            <span className="font-black text-lg sm:text-xl leading-none">{timeLeft.h.toString().padStart(2, '0')}</span>
            <span className="font-medium tracking-tighter text-xs sm:text-sm text-white/90">Hrs</span>
          </div>
          <div className="flex items-baseline gap-0.5 drop-shadow-sm">
            <span className="font-black text-lg sm:text-xl leading-none">{timeLeft.m.toString().padStart(2, '0')}</span>
            <span className="font-medium tracking-tighter text-xs sm:text-sm text-white/90">Min</span>
          </div>
          <div className="flex items-baseline gap-0.5 drop-shadow-sm">
            <span className="font-black text-lg sm:text-xl leading-none">{timeLeft.s.toString().padStart(2, '0')}</span>
            <span className="font-medium tracking-tighter text-xs sm:text-sm text-white/90">Seg</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link 
      href="/minhas-compras" 
      className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
    >
      <Ticket className="h-5 w-5" />
      <span className="text-sm">Meus Números</span>
    </Link>
  );
}

export default function HeaderActions() {
  return (
    <Suspense fallback={<div className="w-24 h-8 bg-gray-100 animate-pulse rounded-md" />}>
      <CountdownBanner />
    </Suspense>
  );
}
