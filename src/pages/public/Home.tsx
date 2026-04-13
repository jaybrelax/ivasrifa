import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ticket, Clock, Trophy, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

export default function Home() {
  const [rifasAtivas, setRifasAtivas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({ 
    nome_sistema: "Sorteios Online", 
    logo_url: "",
    hero_enabled: true,
    hero_titulo: "Realize seus sonhos com nossos sorteios",
    hero_descricao: "Participe de rifas seguras, com sorteios transparentes e prêmios incríveis.",
    hero_imagem_url: ""
  });

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch Config
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

        // Fetch Rifas
        const { data, error } = await supabase
          .from('rifas')
          .select('*')
          .in('status', ['ativa', 'sorteada'])
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setRifasAtivas(data || []);
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            {config.logo_url ? (
              <img src={config.logo_url} alt={config.nome_sistema} className="h-8 object-contain mr-2" />
            ) : (
              <Ticket className="h-6 w-6 text-blue-600 mr-2" />
            )}
            <span className="text-xl font-bold text-gray-900">{config.nome_sistema}</span>
          </div>
          <nav>
            <Button variant="ghost" render={<Link to="/minhas-compras" />} nativeButton={false}>Minhas Compras</Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      {config.hero_enabled && (
        <section 
          className="relative text-white py-20 overflow-hidden"
          style={{
            backgroundColor: config.hero_imagem_url ? 'transparent' : '#2563eb' // bg-blue-600
          }}
        >
          {config.hero_imagem_url && (
            <div className="absolute inset-0 z-0">
              <img 
                src={config.hero_imagem_url} 
                alt="Banner Background" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-blue-900/40 mix-blend-multiply"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent"></div>
            </div>
          )}
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 drop-shadow-lg">
              {config.hero_titulo}
            </h1>
            <p className="text-xl text-blue-50 max-w-2xl mx-auto mb-8 drop-shadow-md">
              {config.hero_descricao}
            </p>
          </div>
        </section>
      )}

      {/* Rifas List */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center mb-8">
          <Trophy className="h-6 w-6 text-yellow-500 mr-2" />
          <h2 className="text-2xl font-bold text-gray-900">Sorteios em Andamento</h2>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : rifasAtivas.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-lg border border-gray-200">
            <Ticket className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Nenhuma rifa ativa no momento</h3>
            <p className="text-gray-500">Volte em breve para conferir novos sorteios!</p>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-2">
            {rifasAtivas.map((rifa) => {
              // Mock progress for now, later we can calculate based on numeros_rifa
              const progresso = 0; 

              return (
                <Card key={rifa.id} className="overflow-hidden hover:shadow-lg transition-shadow border-0 shadow-md">
                  <Link to={`/${rifa.slug || rifa.id}`} className="block overflow-hidden group">
                    <div className="relative h-64 w-full bg-gray-200">
                      {rifa.imagem_url ? (
                        <img
                          src={rifa.imagem_url}
                          alt={rifa.titulo}
                          className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
                          Sem imagem
                        </div>
                      )}
                      <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
                        <Badge className="bg-green-500 text-sm px-3 py-1 shadow-lg ring-2 ring-white">Adquira já</Badge>
                        <Badge variant="secondary" className="bg-blue-600 text-white text-base px-3 py-1 shadow-lg font-bold border-none">
                          R$ {Number(rifa.valor_numero).toFixed(2)}
                        </Badge>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                        <h3 className="text-2xl font-bold text-white group-hover:text-blue-200 transition-colors">{rifa.titulo}</h3>
                      </div>
                    </div>
                  </Link>
                  <CardContent className="p-6">
                    <p className="text-gray-600 mb-6 line-clamp-2">{rifa.descricao}</p>
                    
                    <div className="space-y-4 mb-6">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-500 font-medium">Progresso das Vendas</span>
                          <span className="font-bold text-blue-600">{progresso}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5">
                          <div
                            className="bg-blue-600 h-2.5 rounded-full"
                            style={{ width: `${progresso}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      <div className="flex items-center text-sm text-gray-500">
                        <Clock className="h-4 w-4 mr-2" />
                        Sorteio: {new Date(rifa.data_sorteio).toLocaleDateString('pt-BR')}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-100">
                      <div>
                        <p className="text-sm text-gray-500">Por apenas</p>
                        <p className="text-2xl font-bold text-green-600">
                          R$ {Number(rifa.valor_numero).toFixed(2)}
                        </p>
                      </div>
                      <Button size="lg" className="bg-blue-600 hover:bg-blue-700 uppercase font-black" render={<Link to={`/${rifa.slug || rifa.id}`} />} nativeButton={false}>
                        Reservar números
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
      
      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 text-center">
        <div className="max-w-7xl mx-auto px-4">
          {config.logo_url ? (
            <img src={config.logo_url} alt={config.nome_sistema} className="h-10 object-contain mx-auto mb-4 grayscale opacity-50" />
          ) : (
            <Ticket className="h-8 w-8 text-blue-500 mx-auto mb-4" />
          )}
          <p className="mb-2">© {new Date().getFullYear()} {config.nome_sistema}. Todos os direitos reservados.</p>
          <p className="text-sm mb-6">Este site é destinado exclusivamente para uso de pessoas maiores de 18 anos. Ao acessar e utilizar os serviços oferecidos, você confirma que possui 18 anos ou mais.</p>
          
          <div className="flex flex-wrap justify-center gap-4 text-xs mb-6">
            <Link to="/termos" className="hover:text-white transition-colors">Termos de Uso</Link>
            <Link to="/privacidade" className="hover:text-white transition-colors">Política de Privacidade</Link>
            <Link to="/minhas-compras" className="hover:text-white transition-colors">Minhas Compras</Link>
          </div>

          <Link to="/admin" className="text-xs text-gray-800 hover:text-gray-600 transition-colors block">
            Área Restrita
          </Link>
        </div>
      </footer>
    </div>
  );
}
