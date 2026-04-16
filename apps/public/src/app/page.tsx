import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ticket, Clock, Trophy } from "lucide-react";
import { supabase } from "@shared/supabaseClient";
import Link from "next/link";

async function getData() {
  const [configRes, rifasRes] = await Promise.all([
    supabase.from('vw_configuracoes_publicas').select('*').eq('id', 1).single(),
    supabase.from('rifas').select('*').in('status', ['ativa', 'sorteada']).order('created_at', { ascending: false })
  ]);

  return {
    config: configRes.data || {},
    rifas: rifasRes.data || []
  };
}

export default async function Home() {
  const { config, rifas } = await getData();

  const heroEnabled = config.hero_enabled !== false;

  return (
    <div className="bg-gray-50 pb-20">
      {/* Hero Section */}
      {heroEnabled && (
        <section 
          className="relative text-white py-16 md:py-24 overflow-hidden"
          style={{
            backgroundColor: config.hero_imagem_url ? 'transparent' : '#2563eb' 
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
              {config.hero_titulo || config.nome_sistema}
            </h1>
            <p className="text-xl text-blue-50 max-w-2xl mx-auto mb-8 drop-shadow-md">
              {config.hero_descricao || "Participe dos nossos sorteios e concorra a prêmios incríveis!"}
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

        {rifas.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
            <Ticket className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Nenhuma rifa ativa no momento</h3>
            <p className="text-gray-500">Volte em breve para conferir novos sorteios!</p>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-2">
            {rifas.map((rifa) => {
              const progresso = 0; 

              return (
                <Card key={rifa.id} className="overflow-hidden hover:shadow-xl transition-all duration-300 border-0 shadow-md flex flex-col">
                  <Link href={`/${rifa.slug || rifa.id}`} className="block overflow-hidden group relative">
                    <div className="relative h-64 w-full bg-gray-200">
                      {rifa.imagem_url ? (
                        <img
                          src={rifa.imagem_url}
                          alt={rifa.titulo}
                          className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
                          Sem imagem
                        </div>
                      )}
                      <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
                        <Badge className="bg-green-500 text-xs px-3 py-1 shadow-lg border-0">Adquira já</Badge>
                        <Badge variant="secondary" className="bg-blue-600 text-white text-base px-3 py-1 shadow-lg font-bold border-0">
                          R$ {Number(rifa.valor_numero).toFixed(2)}
                        </Badge>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
                        <h3 className="text-2xl font-bold text-white group-hover:text-blue-200 transition-colors">{rifa.titulo}</h3>
                      </div>
                    </div>
                  </Link>
                  <CardContent className="p-6 flex flex-col flex-grow">
                    <p className="text-gray-600 mb-6 line-clamp-2 h-12">{rifa.descricao}</p>
                    
                    <div className="space-y-4 mb-6 mt-auto">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-500 font-medium text-xs uppercase tracking-wider">Progresso</span>
                          <span className="font-bold text-blue-600">{progresso}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${progresso}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      <div className="flex items-center text-sm text-gray-500">
                        <Clock className="h-4 w-4 mr-2" />
                        Sorteio: {new Date(rifa.data_sorteio).toLocaleDateString('pt-BR')}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Por apenas</p>
                        <p className="text-2xl font-bold text-green-600">
                          R$ {Number(rifa.valor_numero).toFixed(2)}
                        </p>
                      </div>
                      <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 uppercase font-black px-8">
                        <Link href={`/${rifa.slug || rifa.id}`}>
                          Participar
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
