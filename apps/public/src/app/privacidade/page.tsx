import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PrivacidadePage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-12 md:py-20 lg:py-24">
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-blue-600 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para as rifas
        </Link>
      </div>

      <div className="prose prose-blue max-w-none bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-gray-100">
        <h1 className="text-3xl font-bold mb-8">Política de Privacidade</h1>
        
        <p className="text-gray-600 mb-6">Sua privacidade é importante para nós. Esta política descreve como coletamos e usamos seus dados:</p>
        
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-4">1. Coleta de Dados</h2>
          <p className="text-gray-600">Coletamos informações básicas como Nome, CPF, WhatsApp e E-mail apenas para fins de identificação nos sorteios e processamento de pagamentos.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-4">2. Uso das Informações</h2>
          <p className="text-gray-600">Seus dados são utilizados exclusivamente para entrar em contato caso você seja ganhador de um sorteio e para validar suas transações via PIX.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-4">3. Compartilhamento</h2>
          <p className="text-gray-600">Não compartilhamos seus dados pessoais com terceiros, exceto com os processadores de pagamento necessários para concluir sua compra.</p>
        </section>

        <section className="mb-8 text-sm text-gray-400 mt-12 pt-8 border-t border-gray-50">
          Última atualização: {new Date().toLocaleDateString('pt-BR')}
        </section>
      </div>
    </main>
  );
}
