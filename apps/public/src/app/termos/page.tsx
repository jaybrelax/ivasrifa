import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function TermosPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-12 md:py-20 lg:py-24">
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-blue-600 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para as rifas
        </Link>
      </div>

      <div className="prose prose-blue max-w-none bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-gray-100">
        <h1 className="text-3xl font-bold mb-8">Termos de Uso</h1>
        
        <p className="text-gray-600 mb-6">Ao acessar e utilizar este site, você concorda com os seguintes termos e condições:</p>
        
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-4">1. Elegibilidade</h2>
          <p className="text-gray-600">Este site é destinado exclusivamente a pessoas maiores de 18 anos. Ao participar de qualquer sorteio, você declara ter idade legal para tal atividade em sua jurisdição.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-4">2. Participação</h2>
          <p className="text-gray-600">A participação nos sorteios ocorre mediante a aquisição de cotas. Cada cota dá direito a um número ou conjunto de números específicos para o sorteio em questão.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-4">3. Pagamentos</h2>
          <p className="text-gray-600">Todos os pagamentos são processados via PIX. A confirmação da reserva ocorre apenas após a compensação do pagamento pelo sistema bancário.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-4">4. Sorteios</h2>
          <p className="text-gray-600">Os sorteios são realizados com base nos resultados da Loteria Federal ou sistema similar auditável, conforme descrito em cada rifa individual.</p>
        </section>

        <section className="mb-8 text-sm text-gray-400 mt-12 pt-8 border-t border-gray-50">
          Última atualização: {new Date().toLocaleDateString('pt-BR')}
        </section>
      </div>
    </main>
  );
}
