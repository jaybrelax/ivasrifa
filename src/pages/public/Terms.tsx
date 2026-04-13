import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Ticket, ArrowLeft } from "lucide-react";
import { supabase } from "@/src/lib/supabase";

export default function Terms() {
  const [config, setConfig] = useState({ 
    nome_sistema: "Rifa Online", 
    logo_url: ""
  });

  useEffect(() => {
    async function fetchConfig() {
      try {
        const { data } = await supabase
          .from('vw_configuracoes_publicas')
          .select('*')
          .eq('id', 1)
          .single();
          
        if (data) {
          setConfig({
            nome_sistema: data.nome_sistema || "Rifa Online",
            logo_url: data.logo_url || ""
          });
        }
      } catch (error) {
        console.error("Erro ao buscar config:", error);
      }
    }
    fetchConfig();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
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
          <Button variant="ghost" asChild>
            <Link to="/"><ArrowLeft className="w-4 h-4 mr-2" /> Voltar</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 md:p-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-8 border-b pb-4">Termos de Uso</h1>
          
          <div className="prose prose-blue max-w-none text-gray-600 space-y-6 text-justify">
            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3 uppercase tracking-wider text-left">1. Aceitação dos Termos</h2>
              <p>
                Ao acessar e utilizar a plataforma {config.nome_sistema}, você concorda expressamente em cumprir e estar vinculado aos seguintes termos e condições de uso. Se você não concordar com qualquer parte destes termos, não deverá utilizar nossos serviços.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3 uppercase tracking-wider text-left">2. Elegibilidade</h2>
              <p>
                A participação em qualquer sorteio ou rifa através desta plataforma é restrita a pessoas físicas com idade igual ou superior a 18 (dezoito) anos. Ao realizar uma compra, o usuário declara ter plena capacidade civil para tal ato.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3 uppercase tracking-wider text-left">3. Processo de Compra e Pagamento</h2>
              <p>
                A reserva de números ocorre de forma imediata após a seleção. No entanto, a confirmação definitiva da participação depende da compensação do pagamento via PIX no prazo estabelecido pelo sistema (geralmente 15 a 30 minutos). Caso o pagamento não ocorra dentro do prazo, os números serão automaticamente liberados para outros usuários.
              </p>
              <p>
                Os pagamentos são processados via Mercado Pago, garantindo a segurança das transações. {config.nome_sistema} não armazena dados de cartões ou informações sensíveis de pagamento.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3 uppercase tracking-wider text-left">4. Realização dos Sorteios</h2>
              <p>
                Os sorteios serão realizados de forma independente pelos coordenadores do IVAS, garantindo a transparência do processo. O sorteio ocorrerá obrigatoriamente na data predefinida e anunciada na página de cada rifa, independentemente de terem sido vendidas 100% das cotas disponíveis.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3 uppercase tracking-wider text-left">5. Premiação e Entrega</h2>
              <p>
                O ganhador será contatado através dos dados informados no momento da compra (telefone/WhatsApp). É responsabilidade do usuário manter seus dados atualizados. A entrega do prêmio seguirá as condições descritas na página específica da rifa.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3 uppercase tracking-wider text-left">6. Reembolso e Cancelamento</h2>
              <p>
                Devido à natureza dos sorteios digitais e à reserva imediata de números, não são aceitos pedidos de reembolso após a confirmação do pagamento, exceto em casos de cancelamento do sorteio por parte do organizador.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3 uppercase tracking-wider text-left">7. Limitação de Responsabilidade</h2>
              <p>
                A plataforma atua como facilitadora tecnológica para a realização de sorteios. Não nos responsabilizamos por mal uso da plataforma por terceiros ou falhas de conexão por parte do usuário.
              </p>
            </section>

            <section className="pt-8 border-t">
              <p className="text-sm italic">
                Última atualização: {new Date().toLocaleDateString('pt-BR')}
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer Minimalista para Documentos */}
      <footer className="max-w-4xl mx-auto px-4 text-center text-gray-400 text-sm">
        <p>© {new Date().getFullYear()} {config.nome_sistema}. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
