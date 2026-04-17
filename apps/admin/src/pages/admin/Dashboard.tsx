import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { DollarSign, Ticket, Users, TrendingUp, Loader2, Copy, CheckCircle2, Trophy, Target, ExternalLink } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { useState, useEffect } from "react";
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

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalArrecadado: 0,
    numerosVendidos: 0,
    vendedoresAtivos: 0,
    taxaConversao: 0,
    ultimasTransacoes: [] as any[],
    chartData: [] as any[],
    rankingVendedores: [] as any[],
    minhasRifas: [] as any[]
  });
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'guardiao'>('admin');
  const [vendedorData, setVendedorData] = useState<any>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [selectedRifaId, setSelectedRifaId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Verificar Role
        const { data: vData } = await supabase
          .from('vendedores')
          .select('*, is_admin')
          .eq('user_id', session.user.id)
          .maybeSingle();

        const role = (vData && vData.is_admin === false) ? 'guardiao' : 'admin';
        setUserRole(role);
        setVendedorData(vData);

        // --- LOGICA DE VENDAS PESSOAIS (Se tiver perfil de vendedor) ---
        let minhasRifas: any[] = [];
        let totalMeu = 0;
        let totalCotasMinhas = 0;

        if (vData) {
          const { data: rifasAtivas } = await supabase
            .from('rifas')
            .select('id, titulo, meta_guardiao, slug')
            .neq('status', 'rascunho')
            .order('created_at', { ascending: false });

          const { data: minhasVendas } = await supabase
            .from('pedidos')
            .select('valor_total, created_at, quantidade, rifa_id, rifas!inner(status)')
            .eq('vendedor_id', vData.id)
            .eq('status', 'pago')
            .neq('rifas.status', 'rascunho');

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
          // --- LOGICA ADMIN GLOBAL (ignorar rascunhos) ---
          const { data: pedidosPagos } = await supabase
            .from('pedidos')
            .select('valor_total, created_at, vendedor_id, vendedores(nome), rifas!inner(status)')
            .eq('status', 'pago')
            .neq('rifas.status', 'rascunho');

          const totalArrecadado = pedidosPagos?.reduce((acc, curr) => acc + Number(curr.valor_total), 0) || 0;

          const { count: numerosVendidos } = await supabase
            .from('numeros_rifa')
            .select('*, rifas!inner(status)', { count: 'exact', head: true })
            .eq('status', 'vendido')
            .neq('rifas.status', 'rascunho');

          const { count: totalVendedores } = await supabase
            .from('vendedores')
            .select('*', { count: 'exact', head: true });

          const { count: totalPedidos } = await supabase
            .from('pedidos')
            .select('*, rifas!inner(status)', { count: 'exact', head: true })
            .neq('rifas.status', 'rascunho');

          const pedidosPagosCount = pedidosPagos?.length || 0;
          const taxaConversao = totalPedidos && totalPedidos > 0
            ? (pedidosPagosCount / totalPedidos) * 100
            : 0;

          // Ranking de Guardiões (ignorar rascunhos)
          const { data: vendasVendedores } = await supabase
            .from('pedidos')
            .select('vendedor_id, valor_total, vendedores(nome), rifas!inner(status)')
            .eq('status', 'pago')
            .not('vendedor_id', 'is', null)
            .neq('rifas.status', 'rascunho');

          const rankingMap = new Map();
          vendasVendedores?.forEach((v: any) => {
            const nome = Array.isArray(v.vendedores) ? v.vendedores[0]?.nome : (v.vendedores as any)?.nome;
            const current = rankingMap.get(v.vendedor_id) || { nome, total: 0 };
            rankingMap.set(v.vendedor_id, { ...current, total: current.total + Number(v.valor_total) });
          });
          const ranking = Array.from(rankingMap.values())
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

          // Chart Data (7 dias)
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

          setStats(prev => ({
            ...prev,
            totalArrecadado,
            numerosVendidos: numerosVendidos || 0,
            vendedoresAtivos: totalVendedores || 0,
            taxaConversao,
            chartData,
            rankingVendedores: ranking,
            minhasRifas: minhasRifas
          }));

          if (minhasRifas.length > 0) {
            setSelectedRifaId(minhasRifas[0].id);
          }

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

          setStats({
            totalArrecadado: totalMeu,
            numerosVendidos: totalCotasMinhas,
            vendedoresAtivos: 0,
            taxaConversao: 0,
            ultimasTransacoes: [],
            chartData,
            rankingVendedores: [],
            minhasRifas: minhasRifas
          });

          if (minhasRifas.length > 0) {
            setSelectedRifaId(minhasRifas[0].id);
          }
        }
      } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const copyLink = (rifaSlug: string) => {
    if (!vendedorData) return;
    const link = `${window.location.origin}/${rifaSlug}?ref=${vendedorData.codigo_ref}`;
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
          <h1 className="text-2xl font-bold text-gray-900">
            {userRole === 'admin' ? 'Dashboard Global' : `Bem-vindo, ${vendedorData?.nome?.split(' ')[0]}!`}
          </h1>
          <p className="text-gray-500 mb-4">
            {userRole === 'admin' ? 'Visão geral do sistema de rifas.' : 'Gerencie seus links e acompanhe seu desempenho.'}
          </p>
          
          {(userRole === 'guardiao' || (userRole === 'admin' && vendedorData)) && stats.minhasRifas.length > 0 && (
            <div className="w-full max-w-[300px] space-y-1.5">
              <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 ml-1">Campanha Ativa</Label>
              <Select value={selectedRifaId || ""} onValueChange={setSelectedRifaId}>
                <SelectTrigger className="w-full bg-white text-slate-800 font-bold text-sm border-slate-200 h-11 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500/20">
                  <SelectValue placeholder="Escolha uma campanha">
                    {selectedRifa?.titulo}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-md border-slate-100 shadow-2xl bg-white">
                  {stats.minhasRifas.map(r => (
                    <SelectItem
                      key={r.id}
                      value={r.id}
                      className="font-medium text-slate-700 focus:bg-blue-50 focus:text-[#1a6eff] rounded-lg my-0.5 cursor-pointer text-sm"
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
        <Card className="lg:col-span-4 order-2 lg:order-2 border border-slate-100 shadow-xl shadow-slate-200/50 bg-white">
          <CardContent className="p-6 sm:p-8 space-y-8">
            {/* Link Sharing - Layout Empilhado */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-[#1a6eff] rounded-sm"></div>
                <Label className="text-xs uppercase font-black text-slate-700 tracking-wider">Seu Link Personalizado</Label>
              </div>
              <div className="space-y-3">
                <div className="relative group">
                  <div className="bg-blue-50/40 border border-blue-400/30 hover:border-blue-500 transition-all rounded-md px-4 py-3 text-sm text-slate-500 break-all font-mono leading-relaxed shadow-sm">
                    <span className="text-slate-400">{window.location.origin}/</span><span className="text-[#1a6eff] font-bold">{selectedRifa?.slug}</span><span className="text-slate-400">?ref=</span><span className="text-slate-800 font-bold">{vendedorData?.codigo_ref}</span>
                  </div>
                </div>
                <button
                  onClick={() => selectedRifa && copyLink(selectedRifa.slug)}
                  className={`w-full flex items-center justify-center gap-2 h-11 rounded-md font-bold uppercase tracking-wider text-xs transition-all duration-300 ${
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
              </div>
            </div>

            {/* Progress Meta */}
            <div className="space-y-4 pt-6 border-t border-slate-50">
              <div className="flex justify-between items-end">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Desempenho nesta Rifa</span>
                  <span className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <Target className="h-5 w-5 text-[#1a6eff]" /> Meta do Guardião
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-black text-[#1a6eff]">{selectedRifa.vendidos}</span>
                  <span className="text-sm font-bold text-slate-400"> / {selectedRifa.meta}</span>
                </div>
              </div>
              <Progress value={selectedRifa.progresso} className="h-4 bg-slate-100 rounded-full" />
              <p className="text-xs text-slate-500 font-bold italic text-center bg-slate-50 py-2 rounded-lg border border-slate-100">
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
        <Card className="lg:col-span-7 order-2 border-dashed border-2 border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center p-16 text-center rounded-3xl">
          <div className="w-20 h-20 bg-white shadow-sm rounded-3xl flex items-center justify-center mb-6">
            <Ticket className="h-10 w-10 text-slate-300" />
          </div>
          <h3 className="text-slate-900 font-extrabold text-xl">Nenhuma Rifa Ativa</h3>
          <p className="text-slate-500 max-w-[300px] mt-2 text-sm">Você ainda não foi vinculado a nenhuma campanha. Entre em contato com o suporte.</p>
        </Card>
      )}

      {/* Cards de Métricas Rápidas */}
      <div className="lg:col-span-7 grid gap-4 md:grid-cols-2 lg:grid-cols-4 order-4 lg:order-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {userRole === 'admin' ? 'Total Arrecadado' : 'Minhas Vendas (R$)'}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {stats.totalArrecadado.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Baseado em pedidos pagos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {userRole === 'admin' ? 'Números Vendidos' : 'Cotas Vendidas (Qtd)'}
            </CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.numerosVendidos}</div>
            <p className="text-xs text-muted-foreground">Pagamento confirmado</p>
          </CardContent>
        </Card>

        {userRole === 'admin' ? (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.taxaConversao.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">Pedidos pagos / Total de pedidos</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Guardiões</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.vendedoresAtivos}</div>
                <p className="text-xs text-muted-foreground">Vendedores ativos no sistema</p>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="lg:col-span-2 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-800">Status do Guardião</CardTitle>
              <Trophy className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-blue-900">Em Destaque</div>
              <p className="text-xs text-blue-700 font-medium">Continue vendendo para subir no ranking global!</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Gráfico de Vendas */}
      <Card className="lg:col-span-4 order-5 lg:order-4">
        <CardHeader>
          <CardTitle>{userRole === 'admin' ? 'Vendas Globais' : 'Meu Histórico'} (7 dias)</CardTitle>
        </CardHeader>
        <CardContent className="pl-2">
          <ResponsiveContainer width="100%" height={350}>
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
              <Tooltip />
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
        <Card className="lg:col-span-3 order-7 lg:order-5 border-none shadow-xl shadow-slate-200/50 overflow-hidden">
          <CardHeader className="border-b border-slate-50 bg-slate-50/50">
            <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" /> Ranking Guardiões
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              {stats.rankingVendedores.length > 0 ? (
                stats.rankingVendedores.map((v, i) => (
                  <div key={`ranking-${i}`} className="flex items-center gap-4 group">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-[10px] transition-all group-hover:scale-110 ${
                      i === 0 ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-400' :
                      i === 1 ? 'bg-slate-100 text-slate-700 ring-2 ring-slate-200' :
                      i === 2 ? 'bg-orange-100 text-orange-700 ring-2 ring-orange-200' : 'bg-slate-50 text-slate-500'
                    }`}>
                      {i + 1}º
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate uppercase tracking-tighter">{v.nome}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Guardião</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-[#1a6eff]">R$ {v.total.toFixed(2)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 text-center py-4 italic font-medium">Nenhum vendedor com vendas pagas.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
