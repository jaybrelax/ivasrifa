import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, ArrowLeft, Loader2, Ticket, Clock, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/src/lib/supabase";
import { useEffect } from "react";

export default function MinhasCompras() {
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [clienteNome, setClienteNome] = useState("");
  const [config, setConfig] = useState({ 
    nome_sistema: "Sorteios Online", 
    logo_url: "",
    hero_enabled: true,
    hero_titulo: "Realize seus sonhos com nossos sorteios",
    hero_descricao: "Participe de rifas seguras, com sorteios transparentes e prêmios incríveis.",
    hero_imagem_url: ""
  });

  useEffect(() => {
    async function fetchConfig() {
      try {
        const { data: configData } = await supabase
          .from('vw_configuracoes_publicas')
          .select('*')
          .eq('id', 1)
          .single();
          
        if (configData) {
          setConfig({
            nome_sistema: configData.nome_sistema || "Sorteios Online",
            logo_url: configData.logo_url || "",
            hero_enabled: configData.hero_enabled !== false,
            hero_titulo: configData.hero_titulo || "Realize seus sonhos com nossos sorteios",
            hero_descricao: configData.hero_descricao || "Participe de rifas seguras, com sorteios transparentes e prêmios incríveis.",
            hero_imagem_url: configData.hero_imagem_url || ""
          });
        }
      } catch (error) {
        console.error("Erro ao buscar config:", error);
      }
    }
    fetchConfig();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCpf = cpf.replace(/\D/g, '');
    
    if (cleanCpf.length !== 11) {
      alert("Por favor, digite um CPF válido com 11 dígitos.");
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      // 1. Buscar Cliente pelo CPF
      const { data: cliente, error: clienteError } = await supabase
        .from('clientes')
        .select('id, nome_completo')
        .eq('cpf', cleanCpf)
        .maybeSingle();

      if (clienteError) throw clienteError;

      if (!cliente) {
        setPedidos([]);
        setClienteNome("");
        return;
      }

      setClienteNome(cliente.nome_completo);

      // 2. Buscar Pedidos do Cliente
      const { data: pedidosData, error: pedidosError } = await supabase
        .from('pedidos')
        .select(`
          *,
          rifa:rifas (
            titulo,
            imagem_url,
            data_sorteio
          )
        `)
        .eq('cliente_id', cliente.id)
        .order('created_at', { ascending: false });

      if (pedidosError) throw pedidosError;

      setPedidos(pedidosData || []);

    } catch (error) {
      console.error("Erro ao buscar compras:", error);
      alert("Ocorreu um erro ao buscar suas compras. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pago':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Pago</Badge>;
      case 'pendente':
        return <Badge className="bg-yellow-500"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
      case 'expirado':
      case 'cancelado':
        return <Badge className="bg-red-500"><XCircle className="w-3 h-3 mr-1" /> {status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            {config.logo_url ? (
              <img src={config.logo_url} alt={config.nome_sistema} className="h-8 object-contain mr-2" />
            ) : (
              <Ticket className="h-6 w-6 text-blue-600 mr-2" />
            )}
            <span className="text-xl font-bold text-gray-900">{config.nome_sistema}</span>
          </Link>
          <nav>
            <Button variant="ghost" render={<Link to="/" />} nativeButton={false}>Ver Rifas</Button>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Consultar Meus Números</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="cpf">Digite seu CPF</Label>
                <Input 
                  id="cpf" 
                  placeholder="000.000.000-00" 
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  maxLength={14}
                />
              </div>
              <Button type="submit" disabled={loading} className="w-32">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4 mr-2" /> Buscar</>}
              </Button>
            </form>
          </CardContent>
        </Card>

        {searched && !loading && (
          <div className="space-y-6">
            {clienteNome && (
              <h2 className="text-lg font-medium text-gray-700">
                Olá, <span className="font-bold text-gray-900">{clienteNome.split(' ')[0]}</span>! Aqui estão seus pedidos:
              </h2>
            )}

            {pedidos.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <Ticket className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">Nenhuma compra encontrada</h3>
                <p className="text-gray-500 mt-1">Não encontramos pedidos para o CPF informado.</p>
                <Button variant="outline" className="mt-4" render={<Link to="/" />} nativeButton={false}>
                  Ver Rifas Disponíveis
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {pedidos.map((pedido) => (
                  <Card key={pedido.id} className="overflow-hidden">
                    <div className="flex flex-col sm:flex-row">
                      {/* Imagem da Rifa */}
                      <div className="w-full sm:w-48 h-32 sm:h-auto bg-gray-200 relative shrink-0">
                        {pedido.rifa?.imagem_url ? (
                          <img 
                            src={pedido.rifa.imagem_url} 
                            alt={pedido.rifa.titulo} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            Sem imagem
                          </div>
                        )}
                      </div>
                      
                      {/* Detalhes do Pedido */}
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-lg text-gray-900 line-clamp-1">
                              {pedido.rifa?.titulo || "Rifa não encontrada"}
                            </h3>
                            {getStatusBadge(pedido.status)}
                          </div>
                          
                          <div className="text-sm text-gray-500 mb-4">
                            Pedido #{pedido.id.substring(0, 8).toUpperCase()} • {new Date(pedido.created_at).toLocaleDateString('pt-BR')}
                          </div>
                          
                          <div className="bg-gray-50 p-3 rounded-md border border-gray-100">
                            <p className="text-xs text-gray-500 mb-1">Seus números ({pedido.quantidade}):</p>
                            <p className="font-mono font-medium text-blue-700 break-words">
                              {pedido.numeros.join(", ")}
                            </p>
                          </div>
                        </div>
                        
                        <div className="mt-4 flex justify-between items-center pt-4 border-t border-gray-100">
                          <span className="text-gray-600 font-medium">Total: R$ {Number(pedido.valor_total).toFixed(2)}</span>
                          
                          {pedido.status === 'pendente' && (
                            <Button size="sm" render={<Link to={`/rifa/${pedido.rifa_id}`} />} nativeButton={false}>
                              Pagar Agora
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 text-center mt-12 pb-12">
        <div className="max-w-7xl mx-auto px-4">
          {config.logo_url ? (
            <img src={config.logo_url} alt={config.nome_sistema} className="h-10 object-contain mx-auto mb-4 grayscale opacity-50" />
          ) : (
            <Ticket className="h-8 w-8 text-blue-500 mx-auto mb-4" />
          )}
          <p className="mb-2">© {new Date().getFullYear()} {config.nome_sistema}. Todos os direitos reservados.</p>
          <p className="text-sm mb-6">Plataforma segura e transparente para sorteios digitais.</p>
          
          <Link to="/admin" className="text-xs text-gray-800 hover:text-gray-600 transition-colors">
            Área Restrita
          </Link>
        </div>
      </footer>
    </div>
  );
}
