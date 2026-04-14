import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { DollarSign, Ticket, Users, TrendingUp, Loader2 } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts";
import * as React from "react";
import { useState, useEffect } from "react";
import { Copy, CheckCircle2, Trophy, Target, ExternalLink } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { supabase } from "@/src/lib/supabase";

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

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Verificar Role
        const { data: vData } = await supabase
          .from('vendedores')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        const role = vData ? 'guardiao' : 'admin';
        setUserRole(role);
        setVendedorData(vData);

        if (role === 'admin') {
          // --- LOGICA ADMIN GLOBAL ---
          
          // 1. Total Arrecadado (Pedidos Pagos)
          const { data: pedidosPagos } = await supabase
            .from('pedidos')
            .select('valor_total, created_at, vendedor_id, vendedores(nome)')
            .eq('status', 'pago');
            
          const totalArrecadado = pedidosPagos?.reduce((acc, curr) => acc + Number(curr.valor_total), 0) || 0;

          // 2. Números Vendidos
          const { count: numerosVendidos } = await supabase
            .from('numeros_rifa')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'vendido');

          // 3. Vendedores Totais
          const { count: totalVendedores } = await supabase
            .from('vendedores')
            .select('*', { count: 'exact', head: true });

          // 4. Taxa de Conversão
          const { count: totalPedidos } = await supabase
            .from('pedidos')
            .select('*', { count: 'exact', head: true });
            
          const pedidosPagosCount = pedidosPagos?.length || 0;
          const taxaConversao = totalPedidos && totalPedidos > 0 
            ? (pedidosPagosCount / totalPedidos) * 100 
            : 0;

          // 5. Ranking de Guardiões (Quem mais vendeu em R$)
          // Nota: Em um sistema real, faríamos um RPC ou View. 
          // Aqui buscaremos os pedidos e agruparemos manualmente para o MVP.
          const { data: vendasVendedores } = await supabase
            .from('pedidos')
            .select('vendedor_id, valor_total, vendedores(nome)')
            .eq('status', 'pago')
            .not('vendedor_id', 'is', null);

          const rankingMap = new Map();
          vendasVendedores?.forEach((v: any) => {
            const nome = Array.isArray(v.vendedores) ? v.vendedores[0]?.nome : (v.vendedores as any)?.nome;
            const current = rankingMap.get(v.vendedor_id) || { nome, total: 0 };
            rankingMap.set(v.vendedor_id, { ...current, total: current.total + Number(v.valor_total) });
          });
          const ranking = Array.from(rankingMap.values())
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

          // 6. Últimas Transações
          const { data: ultimasTransacoes } = await supabase
            .from('pedidos')
            .select(`id, valor_total, created_at, cliente:clientes(nome_completo, email)`)
            .eq('status', 'pago')
            .order('created_at', { ascending: false })
            .limit(5);

          // 7. Chart Data (7 dias)
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

          setStats({
            totalArrecadado,
            numerosVendidos: numerosVendidos || 0,
            vendedoresAtivos: totalVendedores || 0,
            taxaConversao,
            ultimasTransacoes: ultimasTransacoes || [],
            chartData,
            rankingVendedores: ranking,
            minhasRifas: []
          });

        } else {
          // --- LOGICA GUARDIAO ---
          
          // 1. Rifas que ele participa + Metas
          const { data: rifasRel } = await supabase
            .from('rifa_vendedores')
            .select('rifa_id, rifas(id, titulo, meta_guardiao, slug)')
            .eq('vendedor_id', vData.id);

          // 2. Minhas Vendas
          const { data: minhasVendas } = await supabase
            .from('pedidos')
            .select('valor_total, created_at, quantidade, rifa_id')
            .eq('vendedor_id', vData.id)
            .eq('status', 'pago');

          const totalMeu = minhasVendas?.reduce((acc, curr) => acc + Number(curr.valor_total), 0) || 0;
          const totalCotasMinhas = minhasVendas?.reduce((acc, curr) => acc + curr.quantidade, 0) || 0;

          // Processar rifas com progresso
          const minhasRifasProcessadas = (rifasRel?.map(rel => {
            const r: any = Array.isArray(rel.rifas) ? rel.rifas[0] : rel.rifas;
            if (!r) return null;
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
          }) || []).filter(Boolean);

          // Chart data de vendas pessoais
          const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return d.toISOString().split('T')[0];
          });
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
            minhasRifas: minhasRifasProcessadas || []
          });
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

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-7 gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 lg:col-span-7 order-1">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {userRole === 'admin' ? 'Dashboard Global' : `Bem-vindo, ${vendedorData?.nome.split(' ')[0]}!`}
          </h1>
          <p className="text-gray-500">
            {userRole === 'admin' ? 'Visão geral do sistema de rifas.' : 'Acompanhe seu desempenho e links de divulgação.'}
          </p>
        </div>
        {userRole === 'guardiao' && vendedorData && (
          <Badge className="bg-blue-600 text-white px-3 py-1">Código: {vendedorData.codigo_ref}</Badge>
        )}
      </div>

      {/* Seção Principal p/ Guardião: Meus Links e Metas */}
      {userRole === 'guardiao' && (
        <div className="lg:col-span-7 grid gap-6 md:grid-cols-2 order-3 lg:order-2">
          {stats.minhasRifas.map(rifa => (
            <Card key={rifa.id} className="border-blue-100 shadow-sm overflow-hidden">
              <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
                <h3 className="font-bold truncate mr-2">{rifa.titulo}</h3>
                <a href={`/${rifa.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4 opacity-70 hover:opacity-100 transition-opacity" />
                </a>
              </div>
              <CardContent className="p-5 space-y-5">
                {/* Link Sharing */}
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Meu Link Exclusivo</Label>
                  <div className="flex gap-2">
                    <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-xs font-mono text-gray-500 truncate flex-1">
                      {window.location.origin}/{rifa.slug}?ref={vendedorData.codigo_ref}
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => copyLink(rifa.slug)}
                      className={copiedLink === rifa.slug ? "bg-green-600" : "bg-blue-600"}
                    >
                      {copiedLink === rifa.slug ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Progress Meta */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex justify-between items-end">
                    <Label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center gap-1">
                      <Target className="h-3 w-3" /> Minha Meta de Vendas
                    </Label>
                    <span className="text-xs font-bold text-blue-700">{rifa.vendidos} / {rifa.meta}</span>
                  </div>
                  <Progress value={rifa.progresso} className="h-2 bg-blue-50" />
                  <p className="text-[10px] text-gray-400 italic">Venda {rifa.meta} cotas para atingir o objetivo da campanha.</p>
                </div>
              </CardContent>
            </Card>
          ))}
          {stats.minhasRifas.length === 0 && (
            <Card className="md:col-span-2 border-dashed flex flex-col items-center justify-center p-10 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <Ticket className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">Você ainda não está vinculado a nenhuma rifa ativa.</p>
              <p className="text-sm text-gray-400 mt-1">Peça seu link de recrutamento ao administrador.</p>
            </Card>
          )}
        </div>
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

      {/* Ranking / Lateral Dinâmico */}
      <Card className="lg:col-span-3 order-2 lg:order-5">
        <CardHeader>
          <CardTitle>
            {userRole === 'admin' ? 'Ranking Guardiões' : 'Últimas Transações'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {userRole === 'admin' ? (
              // Ranking de Vendedores
              stats.rankingVendedores.length > 0 ? (
                stats.rankingVendedores.map((v, i) => (
                  <div key={v.nome} className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                      i === 0 ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-400' : 
                      i === 1 ? 'bg-gray-100 text-gray-700 ring-2 ring-gray-400' :
                      i === 2 ? 'bg-orange-100 text-orange-700 ring-2 ring-orange-400' : 'bg-gray-50 text-gray-500'
                    }`}>
                      {i + 1}º
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{v.nome}</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-tighter">Guardião Ativo</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-blue-600">R$ {v.total.toFixed(2)}</p>
                    </div>
                  </div>
                ))
              ) : (
                  <p className="text-sm text-gray-500 text-center py-4 italic">Nenhum vendedor com vendas pagas.</p>
              )
            ) : (
              // Últimas Transações do Guardião
              stats.chartData.some(d => d.vendas > 0) ? (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500">Consulte a aba de Pedidos para ver seus clientes em detalhe.</p>
                  </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4 italic">Você ainda não realizou vendas.</p>
              )
            )}
          </div>
          {userRole === 'admin' && stats.rankingVendedores.length > 0 && (
            <div className="mt-8 pt-4 border-t border-gray-100 text-center">
              <Button variant="ghost" size="sm" className="text-xs text-blue-600 font-bold" render={<Link to="/admin/vendedores" />} nativeButton={false}>
                Ver todos os vendedores
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
