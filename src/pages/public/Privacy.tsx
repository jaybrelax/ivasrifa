import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Ticket, ArrowLeft, ShieldCheck } from "lucide-react";
import { supabase } from "@/src/lib/supabase";

export default function Privacy() {
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
          <div className="flex items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 border-b pb-4 flex-1">Política de Privacidade</h1>
            <ShieldCheck className="h-10 w-10 text-green-600 ml-4 mb-4" />
          </div>
          
          <div className="prose prose-blue max-w-none text-gray-600 space-y-6 text-justify">
            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3 uppercase tracking-wider text-left">1. Introdução</h2>
              <p>
                A Privacidade e a Segurança dos dados de nossos usuários são prioridades fundamentais para a {config.nome_sistema}. Esta política descreve como coletamos, usamos e protegemos suas informações pessoais de acordo com a Lei Geral de Proteção de Dados (LGPD).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3 uppercase tracking-wider text-left">2. Coleta de Dados</h2>
              <p>
                Coletamos apenas os dados necessários para o processamento de suas compras e comunicação sobre os sorteios:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Nome Completo:</strong> Para identificação do ganhador.</li>
                <li><strong>CPF:</strong> Para validação legal da compra e entrega de prêmios.</li>
                <li><strong>WhatsApp/Telefone:</strong> Para envio de comprovantes e contato prioritário em caso de sorteio.</li>
                <li><strong>E-mail (opcional):</strong> Para envio de notificações do sistema.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3 uppercase tracking-wider text-left">3. Uso das Informações</h2>
              <p>
                Seus dados são utilizados exclusivamente para:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Processar pagamentos via Mercado Pago.</li>
                <li>Garantir a integridade dos sorteios.</li>
                <li>Comunicar resultados e novidades da plataforma (podendo o usuário cancelar o recebimento a qualquer momento).</li>
                <li>Cumprir obrigações legais e regulatórias.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3 uppercase tracking-wider text-left">4. Compartilhamento de Dados</h2>
              <p>
                A {config.nome_sistema} não comercializa seus dados pessoais. O compartilhamento ocorre apenas com parceiros essenciais:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Processadores de Pagamento (Mercado Pago):</strong> Para efetivar as transações.</li>
                <li><strong>Autoridades Governamentais:</strong> Quando exigido por lei.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3 uppercase tracking-wider text-left">5. Segurança</h2>
              <p>
                Implementamos medidas de segurança técnicas e organizacionais para proteger seus dados contra acessos não autorizados e situações acidentais ou ilícitas de destruição, perda ou alteração. Utilizamos criptografia SSL em toda a navegação.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3 uppercase tracking-wider text-left">6. Seus Direitos</h2>
              <p>
                Conforme a LGPD, você tem direito a confirmar a existência de tratamento, acessar seus dados, corrigir dados incompletos ou inexatos e solicitar a anonimização ou eliminação de dados desnecessários, desde que não haja obrigação legal de mantê-los.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3 uppercase tracking-wider text-left">7. Cookies</h2>
              <p>
                Utilizamos cookies apenas para melhorar a experiência do usuário e manter sessões ativas. Você pode configurar seu navegador para recusar cookies, mas algumas funcionalidades do site podem ser afetadas.
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

      {/* Footer Minimalista */}
      <footer className="max-w-4xl mx-auto px-4 text-center text-gray-400 text-sm">
        <p>© {new Date().getFullYear()} {config.nome_sistema}. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
