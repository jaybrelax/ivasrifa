import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { Trophy, Medal, Loader2, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function RankingList() {
  const [ranking, setRanking] = useState<any[]>([]);
  const [rifas, setRifas] = useState<any[]>([]);
  const [selectedRifa, setSelectedRifa] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRifas();
  }, []);

  useEffect(() => {
    fetchRanking();
  }, [selectedRifa]);

  async function fetchRifas() {
    try {
      const { data, error } = await supabase.from('rifas').select('id, titulo').order('created_at', { ascending: false });
      if (!error && data) {
        setRifas(data);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchRanking() {
    setLoading(true);
    try {
      // 1. Buscar todos os vendedores
      const { data: vendedores, error: vError } = await supabase
        .from('vendedores')
        .select('*');
      
      if (vError) throw vError;

      // 2. Buscar contagem de pedidos pagos por vendedor_ref
      let query = supabase.from('pedidos').select('vendedor_ref').eq('status', 'pago');
      if (selectedRifa !== "all") {
        query = query.eq('rifa_id', selectedRifa);
      }
      
      const { data: pedidos, error: pError } = await query;
      
      if (pError) throw pError;

      // 3. Processar ranking
      const rankingData = (vendedores || []).map(v => {
        const vendas = (pedidos || []).filter(p => p.vendedor_ref === v.codigo_ref).length;
        return {
          ...v,
          vendas
        };
      }).sort((a, b) => b.vendas - a.vendas);

      setRanking(rankingData);
    } catch (error) {
      console.error("Erro ao buscar ranking:", error);
    } finally {
      setLoading(false);
    }
  }

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 1: return <Medal className="h-6 w-6 text-gray-400" />;
      case 2: return <Medal className="h-6 w-6 text-amber-600" />;
      default: return <span className="text-sm font-bold text-gray-400">#{index + 1}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white p-6 rounded-2xl shadow-sm border border-blue-50">
        <div className="text-center md:text-left">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center justify-center md:justify-start gap-2">
             <Trophy className="text-yellow-500" /> Ranking de Guardiões
          </h1>
          <p className="text-gray-500 text-sm mt-1">Confira o engajamento dos maiores vendedores.</p>
        </div>
        
        <div className="w-full md:w-auto md:min-w-[400px]">
          <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
            <div className="bg-white p-2 text-blue-600 rounded-lg shadow-sm border border-gray-100">
              <Trophy className="h-5 w-5" />
            </div>
            <Select value={selectedRifa} onValueChange={setSelectedRifa}>
              <SelectTrigger className="bg-transparent border-0 shadow-none focus:ring-0 font-bold text-gray-700 h-auto p-1 flex-1 text-left text-base line-clamp-1 truncate">
                <SelectValue>
                  {selectedRifa === "all" 
                    ? "🏆 Mostrar Ranking Global" 
                    : rifas.find(r => r.id.toString() === selectedRifa)?.titulo || "Selecione a Rifa"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl font-medium">
                <SelectItem value="all">🏆 Mostrar Ranking Global</SelectItem>
                {rifas.map(r => (
                  <SelectItem key={r.id} value={r.id.toString()}>{r.titulo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <Card className="border-blue-100 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-blue-50">
            <CardTitle className="text-sm uppercase tracking-wider text-slate-500 font-bold">Top Vendedores</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {ranking.length > 0 ? (
                ranking.map((vendedor, index) => (
                  <div key={vendedor.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-8 flex justify-center shrink-0">
                        {getRankIcon(index)}
                      </div>
                      
                      <Avatar className="h-10 w-10 border-2 border-white shadow-sm shrink-0">
                        <AvatarImage src={vendedor.avatar_url} />
                        <AvatarFallback className="bg-blue-100 text-blue-700 font-bold">
                          {vendedor.nome?.charAt(0).toUpperCase() || <User size={16} />}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 truncate">{vendedor.nome}</p>
                        <p className="text-xs text-gray-500 truncate">@{vendedor.codigo_ref}</p>
                      </div>
                    </div>

                    <div className="text-right">
                       <p className="text-lg font-black text-blue-600">{vendedor.vendas}</p>
                       <p className="text-[10px] uppercase font-bold text-gray-400">Vendas</p>
                    </div>
                  </div>
                ))
              ) : (
                 <div className="p-8 text-center text-gray-500">Nenhum vendedor encontrado no ranking.</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
