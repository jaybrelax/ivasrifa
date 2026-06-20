import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { DollarSign, Ticket, Users, TrendingUp, Loader2, Copy, CheckCircle2, Trophy, Target, ExternalLink, Timer, QrCode } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import QRCode from "react-qr-code";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { LaserBorder } from "@/components/magic/LaserBorder";

export default function Dashboard() {
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [selectedRifaId, setSelectedRifaId] = useState<string | null>(null);
  const [endAtivado, setEndAtivado] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: dashboardData, isLoading: loading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      // Verificar Role
      const { data: vData } = await supabase
        .from('vendedores')
        .select('*, is_admin')
        .eq('user_id', session.user.id)
        .maybeSingle();

      const role = (vData && vData.is_admin === false) ? 'guardiao' : 'admin';
      
      // --- LOGICA DE VENDAS PESSOAIS ---
      let minhasRifas: any[] = [];
      let totalMeu = 0;
      let totalCotasMinhas = 0;

      if (vData) {
        let rifasQuery = supabase
          .from('rifas')
          .select('id, titulo, meta_guardiao, slug, status')
          .neq('status', 'rascunho'); // Para guardião, sempre ocultar rascunhos

        if (vData.is_admin === true) {
          // Se for admin, buscar todas (inclusive rascunho) na lista de campanhas
          rifasQuery = supabase
            .from('rifas')
            .select('id, titulo, meta_guardiao, slug, status')
            .order('created_at', { ascending: false });
        }

        const { data: rifasAtivas } = await rifasQuery;

        const { data: minhasVendas } = await supabase
          .from('pedidos')
          .select('valor_total, created_at, quantidade, rifa_id, rifas!inner(status)')
          .eq('vendedor_id', vData.id)
          .eq('status', 'pago');

        totalMeu = minhasVendas?.reduce((acc, curr) => acc + Number(curr.valor_total), 0) || 0;
        totalCotasMinhas = minhasVendas?.reduce((acc, curr) => acc + curr.quantidade, 0) || 0;

        minhasRifas = (rifasAtivas || []).map(r => {
          const vendasDessaRifa = minhasVendas?.filter(v => v.rifa_id === r.id)
            .reduce((acc, curr) => acc + curr.quantidade, 0) || 0;
          return {
            id: r.id,
            titulo: r.titulo,
            slug: r.slug,
            meta: r.meta_guardiao || 50,
            vendidos: vendasDessaRifa,
            progresso: Math.min((vendasDessaRifa / (r.meta_guardiao || 50)) * 100, 100)
          };
        });
      }

      if (role === 'admin') {
        // --- LOGICA ADMIN GLOBAL ---
        const { data: pedidosPagos } = await supabase
          .from('pedidos')
          .select('valor_total, created_at, vendedor_id, vendedores(nome), rifas!inner(status)')
          .eq('status', 'pago');

        const totalArrecadado = pedidosPagos?.reduce((acc, curr) => acc + Number(curr.valor_total), 0) || 0;

        const { count: numerosVendidos } = await supabase
          .from('numeros_rifa')
          .select('*, rifas!inner(status)', { count: 'exact', head: true })
          .eq('status', 'vendido');

        const { count: totalVendedores } = await supabase
          .from('vendedores')
          .select('*', { count: 'exact', head: true });

        const { count: totalPedidos } = await supabase
          .from('pedidos')
          .select('*, rifas!inner(status)', { count: 'exact', head: true });

        const pedidosPagosCount = pedidosPagos?.length || 0;
        const taxaConversao = totalPedidos && totalPedidos > 0
          ? (pedidosPagosCount / totalPedidos) * 100
          : 0;

        // Ranking
        const rankingMap = new Map();
        pedidosPagos?.forEach((v: any) => {
          if (!v.vendedor_id) return;
          const nome = Array.isArray(v.vendedores) ? v.vendedores[0]?.nome : (v.vendedores as any)?.nome;
          const current = rankingMap.get(v.vendedor_id) || { nome, total: 0 };
          rankingMap.set(v.vendedor_id, { ...current, total: current.total + Number(v.valor_total) });
        });
        const ranking = Array.from(rankingMap.values())
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);

        // Chart Data
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return d.toISOString().split('T')[0];
        });
        const chartData = last7Days.map(date => {
          const dayName = new Date(date).toLocaleDateString('pt-BR', { weekday: 'short' });
          const vendasDoDia = pedidosPagos?.filter(p => p.created_at.startsWith(date))
            .reduce((acc, curr) => acc + Number(curr.valor_total), 0) || 0;
          return { name: dayName, vendas: vendasDoDia };
        });

        return {
          role,
          vendedorData: vData,
          stats: {
            totalArrecadado,
            numerosVendidos: numerosVendidos || 0,
            vendedoresAtivos: totalVendedores || 0,
            taxaConversao,
            chartData,
            rankingVendedores: ranking,
            minhasRifas: minhasRifas
          }
        };
      } else {
        // --- LOGICA GUARDIAO ---
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return d.toISOString().split('T')[0];
        });
        
        const { data: minhasVendas } = await supabase
          .from('pedidos')
          .select('valor_total, created_at, quantidade, rifa_id, rifas!inner(status)')
          .eq('vendedor_id', vData.id)
          .eq('status', 'pago')
          .neq('rifas.status', 'rascunho');

        const chartData = last7Days.map(date => {
          const dayName = new Date(date).toLocaleDateString('pt-BR', { weekday: 'short' });
          const vendasDoDia = minhasVendas?.filter(p => p.created_at.startsWith(date))
            .reduce((acc, curr) => acc + Number(curr.valor_total), 0) || 0;
          return { name: dayName, vendas: vendasDoDia };
        });

        return {
          role,
          vendedorData: vData,
          stats: {
            totalArrecadado: totalMeu,
            numerosVendidos: totalCotasMinhas,
            vendedoresAtivos: 0,
            taxaConversao: 0,
            chartData,
            rankingVendedores: [],
            minhasRifas: minhasRifas
          }
        };
      }
    }
  });

  const stats = dashboardData?.stats || {
    totalArrecadado: 0,
    numerosVendidos: 0,
    vendedoresAtivos: 0,
    taxaConversao: 0,
    chartData: [],
    rankingVendedores: [],
    minhasRifas: []
  };
  const userRole = dashboardData?.role || 'admin';
  const vendedorData = dashboardData?.vendedorData;

  useEffect(() => {
    if (!selectedRifaId && stats.minhasRifas.length > 0) {
      setSelectedRifaId(stats.minhasRifas[0].id);
    }
  }, [stats.minhasRifas]);

  const buildLink = (rifaSlug: string) => {
    if (!vendedorData) return '';
    const base = `https://rifa.virtudes.net.br/${rifaSlug}?ref=${vendedorData.codigo_ref}`;
    return endAtivado ? `${base}&end=5` : base;
  };

  const copyLink = (rifaSlug: string) => {
    if (!vendedorData) return;
    const link = buildLink(rifaSlug);
    navigator.clipboard.writeText(link);
    setCopiedLink(rifaSlug);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const selectedRifa = stats.minhasRifas.find(r => r.id === selectedRifaId) || stats.minhasRifas[0];

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-7 gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 lg:col-span-7 order-1">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            {userRole === 'admin' ? 'Dashboard Global' : `Bem-vindo, ${vendedorData?.nome?.split(' ')[0]}!`}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mb-4">
            {userRole === 'admin' ? 'Visão geral do sistema de rifas.' : 'Gerencie seus links e acompanhe seu desempenho.'}
          </p>
          
          {(userRole === 'guardiao' || (userRole === 'admin' && vendedorData)) && stats.minhasRifas.length > 1 && (
            <div className="w-full max-w-[300px] space-y-1.5">
              <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500 ml-1">Campanha Ativa</Label>
              <Select value={selectedRifaId || ""} onValueChange={setSelectedRifaId}>
                <SelectTrigger className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold text-sm border-slate-200 dark:border-slate-800 h-11 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500/20">
                  <SelectValue placeholder="Escolha uma campanha">
                    {selectedRifa?.titulo}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-md border-slate-100 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
                  {stats.minhasRifas.map(r => (
                    <SelectItem
                      key={r.id}
                      value={r.id}
                      className="font-medium text-slate-700 dark:text-slate-300 focus:bg-blue-50 dark:focus:bg-slate-800 focus:text-[#1a6eff] dark:focus:text-blue-400 rounded-lg my-0.5 cursor-pointer text-sm"
                    >
                      {r.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Seção Principal do Guardião: Link de Venda */}
      {(userRole === 'guardiao' || (userRole === 'admin' && vendedorData)) && selectedRifa && (
        <Card className="lg:col-span-4 order-2 lg:order-2 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900">
          <CardContent className="p-4 sm:p-5 space-y-5">
            {/* Link Sharing - Layout Empilhado */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-[#1a6eff] rounded-sm"></div>
                <Label className="text-xs uppercase font-black text-slate-700 dark:text-slate-300 tracking-wider">Seu Link Personalizado</Label>
              </div>
              <div className="space-y-2">
                <LaserBorder
                  className="rounded-md overflow-hidden p-[2px] group"
                  duration={3}
                  width={3}
                  color="#1a6eff"
                  glowColor="rgba(168, 85, 247, 0.6)"
                  rx={6}
                >
                  {/* Conteúdo interno do Input */}
                  <div className="relative bg-white dark:bg-slate-900 rounded-[5px] px-4 py-3 text-sm font-mono shadow-sm w-full h-11 flex items-center overflow-hidden">
                    {/* Fade na esquerda */}
                    <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-white dark:from-slate-900 to-transparent z-10 pointer-events-none" />
                    
                    {/* Texto posicionado à direita em 1 linha */}
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 whitespace-nowrap">
                      <span className="text-slate-400 dark:text-slate-500">https://rifa.virtudes.net.br/</span>
                      <span className="text-[#1a6eff] dark:text-[#3b82f6] font-bold">{selectedRifa?.slug}</span>
                      <span className="text-slate-400 dark:text-slate-500">?ref=</span>
                      <span className="text-slate-800 dark:text-slate-200 font-bold">{vendedorData?.codigo_ref}</span>
                      {endAtivado && <span className="text-orange-500 font-bold">&end=5</span>}
                    </div>
                  </div>
                </LaserBorder>
                <div className="flex items-center gap-2">
                  {/* Switch Ativar Fim */}
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 leading-none">Timer</span>
                    <div className="flex items-center gap-1.5">
                      <Timer className={`h-4 w-4 transition-colors ${endAtivado ? 'text-orange-500' : 'text-slate-400 dark:text-slate-600'}`} />
                      <button
                        type="button"
                        role="switch"
                        aria-checked={endAtivado}
                        onClick={() => setEndAtivado(!endAtivado)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-all duration-200 focus-visible:outline-none ${
                          endAtivado
                            ? 'bg-orange-500 shadow-orange-200 dark:shadow-orange-950 shadow-inner'
                            : 'bg-slate-200 dark:bg-slate-800'
                        }`}
                      >
                        <span className={`pointer-events-none block h-5 w-5 rounded-full bg-white dark:bg-slate-100 shadow-md ring-0 transition-transform duration-200 ${endAtivado ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Botão Copiar Link */}
                  <div className="flex-1 flex gap-2">
                    <button
                      onClick={() => selectedRifa && copyLink(selectedRifa.slug)}
                      className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-md font-bold uppercase tracking-wider text-xs transition-all duration-300 ${
                        copiedLink === selectedRifa?.slug
                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                        : "bg-[#1a6eff] text-white shadow-md shadow-blue-500/20 hover:bg-blue-600 active:scale-[0.98]"
                      }`}
                    >
                      {copiedLink === selectedRifa?.slug ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          <span>Copiar link</span>
                        </>
                      )}
                    </button>
                    {/* Botão QR Code */}
                    <button
                      type="button"
                      onClick={() => setIsQrModalOpen(true)}
                      className="flex items-center justify-center w-11 h-11 shrink-0 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors shadow-sm"
                    >
                      <QrCode className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Meta */}
            <div className="space-y-2 pt-3 border-t border-slate-50 dark:border-slate-800/60">
              <div className="flex justify-between items-end">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Desempenho nesta Rifa</span>
                  <span className="text-lg font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Target className="h-5 w-5 text-[#1a6eff]" /> Meta do Guardião
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-black text-[#1a6eff]">{selectedRifa.vendidos}</span>
                  <span className="text-sm font-bold text-slate-400 dark:text-slate-500"> / {selectedRifa.meta}</span>
                </div>
              </div>
              <Progress value={selectedRifa.progresso} className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold italic text-center -mb-2 mt-1">
                Você já atingiu {selectedRifa.progresso.toFixed(1)}% do seu objetivo!
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card de Destaque Lateral: Rumo ao Topo */}
      {(userRole === 'guardiao' || (userRole === 'admin' && vendedorData)) && selectedRifa && (
        <Card className="lg:col-span-3 order-6 lg:order-2 bg-gradient-to-br from-[#1a6eff] to-blue-700 border-none shadow-xl rounded-3xl p-6 flex flex-col justify-center text-white relative overflow-hidden">
          <div className="absolute -bottom-10 -right-10 opacity-20 rotate-12">
            <Trophy size={200} />
          </div>
          <div className="relative z-10 space-y-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <Trophy className="h-6 w-6 text-white" />
            </div>
            <h4 className="text-2xl font-black uppercase leading-tight">Rumo ao Topo!</h4>
            <p className="text-blue-100 text-sm font-medium leading-relaxed">
              Cada venda coloca você mais perto das primeiras posições do ranking global de guardiões.
            </p>
            <Link to="/ranking" className="w-full inline-flex items-center justify-center h-8 px-2.5 rounded-lg font-black uppercase text-xs tracking-widest bg-white text-[#1a6eff] hover:bg-blue-50 transition-colors">Ver Ranking Global</Link>
          </div>
        </Card>
      )}

      {/* Fallback se não houver rifa */}
      {userRole === 'guardiao' && !selectedRifa && (
        <Card className="lg:col-span-7 order-2 border-dashed border-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col items-center justify-center p-16 text-center rounded-3xl">
          <div className="w-20 h-20 bg-white dark:bg-slate-800 shadow-sm rounded-3xl flex items-center justify-center mb-6">
            <Ticket className="h-10 w-10 text-slate-300 dark:text-slate-600" />
          </div>
          <h3 className="text-slate-900 dark:text-slate-100 font-extrabold text-xl">Nenhuma Rifa Ativa</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-[300px] mt-2 text-sm">Você ainda não foi vinculado a nenhuma campanha. Entre em contato com o suporte.</p>
        </Card>
      )}

      {/* Cards de Métricas Rápidas */}
      <div className="lg:col-span-7 grid gap-4 md:grid-cols-2 lg:grid-cols-4 order-4 lg:order-3">
        <Card className={`${userRole === 'admin' ? "md:col-span-2 lg:col-span-2" : ""} border border-slate-100 dark:border-slate-800 bg-card shadow-sm`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {userRole === 'admin' ? 'Total Arrecadado' : 'Minhas Vendas (R$)'}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {userRole === 'admin' ? (
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-0.5">Bruto</p>
                  <div className="text-2xl font-bold">R$ {stats.totalArrecadado.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</div>
                  <p className="text-[10px] text-muted-foreground">Pedidos pagos</p>
                </div>
                <div className="flex-1 border-l border-slate-200 dark:border-slate-800 pl-4">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-0.5">Líquido (MP)</p>
                  <div className="text-2xl font-bold">R$ {(stats.totalArrecadado * 0.9901).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Taxa (0.99%): <span className="text-red-500 dark:text-red-400 font-medium">-R$ {(stats.totalArrecadado * 0.0099).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold">R$ {stats.totalArrecadado.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground">Baseado em pedidos pagos</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card className={`${userRole === 'admin' ? "md:col-span-2 lg:col-span-2" : ""} border border-slate-100 dark:border-slate-800 bg-card shadow-sm`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {userRole === 'admin' ? 'Números Vendidos & Conversão' : 'Cotas Vendidas (Qtd)'}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-muted-foreground" />
              {userRole === 'admin' && <TrendingUp className="h-4 w-4 text-muted-foreground" />}
            </div>
          </CardHeader>
          <CardContent>
            {userRole === 'admin' ? (
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-0.5">Vendidos</p>
                  <div className="text-2xl font-bold">{stats.numerosVendidos}</div>
                  <p className="text-[10px] text-muted-foreground">Pagamento confirmado</p>
                </div>
                <div className="flex-1 border-l border-slate-200 dark:border-slate-800 pl-4">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-0.5">Conversão</p>
                  <div className="text-2xl font-bold">{stats.taxaConversao.toFixed(1)}%</div>
                  <p className="text-[10px] text-muted-foreground">Pagos / Total</p>
                </div>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold">{stats.numerosVendidos}</div>
                <p className="text-xs text-muted-foreground">Pagamento confirmado</p>
              </>
            )}
          </CardContent>
        </Card>

        {userRole !== 'admin' && (
          <Card className="lg:col-span-2 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-100 dark:border-blue-900/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-300">Status do Guardião</CardTitle>
              <Trophy className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-blue-900 dark:text-blue-100">Em Destaque</div>
              <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">Continue vendendo para subir no ranking global!</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Gráfico de Vendas */}
      <Card className="lg:col-span-4 order-5 lg:order-4 border border-slate-100 dark:border-slate-800 bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-800 dark:text-slate-200">{userRole === 'admin' ? 'Vendas Globais' : 'Meu Histórico'} (7 dias)</CardTitle>
        </CardHeader>
        <CardContent className="pl-2">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.chartData}>
              <XAxis
                dataKey="name"
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `R$${value}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  borderColor: 'var(--border)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--foreground)'
                }}
                itemStyle={{ color: 'var(--foreground)' }}
                labelStyle={{ color: 'var(--muted-foreground)' }}
              />
              <Bar dataKey="vendas" fill="#2563eb" radius={[4, 4, 0, 0]}>
                {stats.chartData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 6 ? '#2563eb' : '#93c5fd'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Ranking - Apenas Admin */}
      {userRole === 'admin' && (
        <Card className="lg:col-span-3 order-7 lg:order-5 border border-slate-100 dark:border-slate-800 bg-card shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <CardTitle className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" /> Ranking Guardiões
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              {stats.rankingVendedores.length > 0 ? (
                stats.rankingVendedores.map((v, i) => (
                  <div key={`ranking-${i}`} className="flex items-center gap-4 group">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-[10px] transition-all group-hover:scale-110 ${
                      i === 0 ? 'bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400 ring-2 ring-yellow-400 dark:ring-yellow-500/50' :
                      i === 1 ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 ring-2 ring-slate-200 dark:ring-slate-700' :
                      i === 2 ? 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 ring-2 ring-orange-200 dark:ring-orange-500/50' : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400'
                    }`}>
                      {i + 1}º
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-800 dark:text-slate-200 truncate uppercase tracking-tighter">{v.nome}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Guardião</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-[#1a6eff]">R$ {v.total.toFixed(2)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4 italic font-medium">Nenhum vendedor com vendas pagas.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal do QR Code */}
      <Dialog open={isQrModalOpen} onOpenChange={setIsQrModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-center font-bold text-xl text-slate-800 dark:text-slate-200">
              QR Code do Link
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-6 space-y-6">
            <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 inline-block">
              {selectedRifa && (
                <QRCode
                  value={buildLink(selectedRifa.slug)}
                  size={200}
                  level="H"
                  className="rounded-lg"
                />
              )}
            </div>
            <p className="text-sm text-center text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-[280px]">
              Escaneie o QR code acima com a câmera do seu celular para acessar a página.
            </p>
          </div>
          <div className="flex gap-3 p-6 pt-2 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              className="flex-1 bg-[#1a6eff] hover:bg-blue-600 text-white font-bold tracking-wide shadow-md shadow-blue-500/20"
              onClick={() => {
                if (selectedRifa) {
                  window.open(buildLink(selectedRifa.slug), '_blank');
                  setIsQrModalOpen(false);
                }
              }}
            >
              Acessar
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={() => setIsQrModalOpen(false)}
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
