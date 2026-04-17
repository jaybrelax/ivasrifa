import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function TermosPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-12 md:py-20 lg:py-24">
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-[#1b5df1] transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para as rifas
        </Link>
      </div>

      <div className="prose prose-blue max-w-none bg-white p-8 md:p-12 rounded-[32px] shadow-sm border border-gray-100">
        <h1 className="text-3xl font-black text-slate-900 mb-8 tracking-tight">Termos de Uso</h1>
        
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">1. Aceitação dos Termos</h2>
          <p className="text-gray-600 leading-relaxed">Ao acessar e utilizar a plataforma Rifa IVAS, você concorda expressamente em cumprir e estar vinculado aos seguintes termos e condições de uso. Se você não concordar com qualquer parte destes termos, não deverá utilizar nossos serviços.</p>
        </section>
        
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">2. Elegibilidade</h2>
          <p className="text-gray-600 leading-relaxed">A participação em qualquer sorteio ou rifa através desta plataforma é restrita a pessoas físicas com idade igual ou superior a 18 (dezoito) anos. Ao realizar uma compra, o usuário declara ter plena capacidade civil para tal ato.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">3. Processo de Compra e Pagamento</h2>
          <p className="text-gray-600 leading-relaxed">A reserva de números ocorre de forma imediata após a seleção. No entanto, a confirmação definitiva da participação depende da compensação do pagamento via PIX no prazo estabelecido pelo sistema (geralmente 15 a 30 minutos). Caso o pagamento não ocorra dentro do prazo, os números serão automaticamente liberados para outros usuários.</p>
          <p className="text-gray-600 leading-relaxed mt-4">Os pagamentos são processados via Mercado Pago, garantindo a segurança das transações. Rifa IVAS não armazena dados de cartões ou informações sensíveis de pagamento.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">4. Realização dos Sorteios</h2>
          <p className="text-gray-600 leading-relaxed">Os sorteios serão realizados de forma independente pelos coordenadores do IVAS, garantindo a transparência do processo. O sorteio ocorrerá obrigatoriamente na data predefinida e anunciada na página de cada rifa, independentemente de terem sido vendidas 100% das cotas disponíveis.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">5. Premiação e Entrega</h2>
          <p className="text-gray-600 leading-relaxed">O ganhador será contatado através dos dados informados no momento da compra (telefone/WhatsApp). É responsabilidade do usuário manter seus dados atualizados. A entrega do prêmio seguirá as condições descritas na página específica da rifa.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">6. Reembolso e Cancelamento</h2>
          <p className="text-gray-600 leading-relaxed">Devido à natureza dos sorteios digitais e à reserva imediata de números, não são aceitos pedidos de reembolso após a confirmação do pagamento, exceto em casos de cancelamento do sorteio por parte do organizador.</p>
        </section>

        <section className="mb-12">
          <h2 className="text-xl font-bold text-slate-800 mb-4">7. Limitação de Responsabilidade</h2>
          <p className="text-gray-600 leading-relaxed">A plataforma atua como facilitadora tecnológica para a realização de sorteios. Não nos responsabilizamos por mal uso da plataforma por terceiros ou falhas de conexão por parte do usuário.</p>
        </section>

        <section className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pt-8 border-t border-gray-50">
          Última atualização: {new Date().toLocaleDateString('pt-BR')}
        </section>
      </div>
    </main>
  );
}
