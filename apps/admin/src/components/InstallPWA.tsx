import { useState, useEffect } from 'react';
import { Smartphone, Download, X } from 'lucide-react';
import { Button } from './ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';

export function InstallPWA() {
  const [showBanner, setShowBanner] = useState(false);
  const { isInstallable, isInstalled, installPWA } = usePWAInstall();

  useEffect(() => {
    // Mostra o banner apenas em mobile e se for instalável
    if (isInstallable && !isInstalled && window.innerWidth < 1024) {
      setShowBanner(true);
    } else {
      setShowBanner(false);
    }
  }, [isInstallable, isInstalled]);

  const handleInstallClick = async () => {
    const success = await installPWA();
    if (success) {
      setShowBanner(false);
    }
  };

  if (!showBanner) return null;

  return (
    <div className="mx-4 mt-4 lg:hidden">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-4 shadow-lg shadow-blue-200 dark:shadow-none border border-transparent dark:border-slate-700/50 relative overflow-hidden group">
        {/* Decoração de fundo */}
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 dark:bg-slate-700/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
        <div className="absolute -left-4 -bottom-4 w-20 h-20 bg-blue-400/20 dark:bg-slate-700/20 rounded-full blur-xl" />
        
        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 dark:bg-slate-800 backdrop-blur-md rounded-xl flex items-center justify-center shrink-0 shadow-inner dark:shadow-none border dark:border-slate-700/50">
            <Smartphone className="h-6 w-6 text-white dark:text-slate-300" />
          </div>
          
          <div className="flex-1">
            <h3 className="text-white dark:text-slate-100 font-bold text-sm leading-tight">Instalar App Admin</h3>
            <p className="text-blue-100 dark:text-slate-400 text-[11px] mt-0.5 leading-relaxed">
              Acesse o painel mais rápido e receba notificações direto no celular.
            </p>
          </div>

          <Button 
            onClick={handleInstallClick}
            size="sm"
            className="bg-white dark:bg-[#1a6eff] text-blue-600 dark:text-white hover:bg-blue-50 dark:hover:bg-blue-600 font-bold text-xs h-9 px-4 rounded-xl shadow-md dark:shadow-none active:scale-95 transition-all"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Instalar
          </Button>

          <button 
            onClick={() => setShowBanner(false)}
            className="absolute -top-1 -right-1 p-1 text-white/60 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
