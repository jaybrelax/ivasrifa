import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Ticket, Users, TrendingUp, Loader2 } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalArrecadado: 0,
    numerosVendidos: 0,
    vendedoresAtivos: 0,
    taxaConversao: 0,
    ultimasTransacoes: [] as any[],
    chartData: [] as any[]
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // 1. Total Arrecadado (Pedidos Pagos)
        const { data: pedidosPagos, error: pedidosError } = await supabase
          .from('pedidos')
          .select('valor_total, created_at')
          .eq('status', 'pago');
          
        const totalArrecadado = pedidosPagos?.reduce((acc, curr) => acc + Number(curr.valor_total), 0) || 0;

        // 2. Números Vendidos
        const { count: numerosVendidos, error: numerosError } = await supabase
          .from('numeros_rifa')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'vendido');

        // 3. Vendedores Ativos (ou Clientes Totais se não tiver vendedores ainda)
        const { count: clientesTotais, error: clientesError } = await supabase
          .from('clientes')
          .select('*', { count: 'exact', head: true });

        // 4. Taxa de Conversão (Pedidos Pagos / Total de Pedidos)
        const { count: totalPedidos } = await supabase
          .from('pedidos')
          .select('*', { count: 'exact', head: true });
          
        const pedidosPagosCount = pedidosPagos?.length || 0;
        const taxaConversao = totalPedidos && totalPedidos > 0 
          ? (pedidosPagosCount / totalPedidos) * 100 
          : 0;

        // 5. Últimas Transações
        const { data: ultimasTransacoes, error: transacoesError } = await supabase
          .from('pedidos')
          .select(`
            id, 
            valor_total, 
            created_at, 
            cliente:clientes(nome_completo, email)
          `)
          .eq('status', 'pago')
          .order('created_at', { ascending: false })
          .limit(5);

        // 6. Chart Data (Últimos 7 dias)
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
          vendedoresAtivos: clientesTotais || 0, // Usando clientes como métrica temporária
          taxaConversao,
          ultimasTransacoes: ultimasTransacoes || [],
          chartData
        });
      } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Visão geral do sistema de rifas.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Arrecadado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {stats.totalArrecadado.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Baseado em pedidos pagos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Números Vendidos</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.numerosVendidos}</div>
            <p className="text-xs text-muted-foreground">Números com pagamento confirmado</p>
          </CardContent>
        </Card>
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
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.vendedoresAtivos}</div>
            <p className="text-xs text-muted-foreground">Cadastrados no sistema</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Vendas (Últimos 7 dias)</CardTitle>
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
                <Bar dataKey="vendas" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Últimas Transações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {stats.ultimasTransacoes.length > 0 ? (
                stats.ultimasTransacoes.map((transacao) => (
                  <div key={transacao.id} className="flex items-center">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {transacao.cliente?.nome_completo || 'Cliente Desconhecido'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {transacao.cliente?.email || 'Sem e-mail'}
                      </p>
                    </div>
                    <div className="ml-auto font-medium text-green-600">
                      +R$ {Number(transacao.valor_total).toFixed(2)}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">Nenhuma transação recente.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
